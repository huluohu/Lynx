#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印函数
print_step() {
    local current=$1
    local total=$2
    local description=$3
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN} 步骤 $current/$total: $description${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

read_env_value() {
    local key="$1"
    local file="$2"
    if [ -f "$file" ] && grep -q "^${key}=" "$file"; then
        grep "^${key}=" "$file" | tail -n 1 | cut -d'=' -f2-
    fi
}

upsert_env_value() {
    local key="$1"
    local value="$2"
    local file="$3"
    mkdir -p "$(dirname "$file")"
    if [ -f "$file" ] && grep -q "^${key}=" "$file"; then
        sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    else
        touch "$file"
        printf '%s=%s\n' "$key" "$value" >> "$file"
    fi
}

sync_dockerhub_description() {
    local repository="$1"
    local short_description="$2"
    local overview_file="$3"

    if [ -z "$DOCKERHUB_USERNAME" ] || [ -z "$DOCKERHUB_TOKEN" ]; then
        print_warning "已启用 Docker Hub 介绍同步，但缺少 DOCKERHUB_USERNAME / DOCKERHUB_TOKEN，跳过同步"
        return 0
    fi

    if [ ! -f "$overview_file" ]; then
        print_warning "Docker Hub Overview 文件不存在：$overview_file，跳过同步"
        return 0
    fi

    print_info "同步 Docker Hub 仓库介绍：$repository"

    local login_response
    local jwt_token
    login_response=$(curl -fsSL https://hub.docker.com/v2/users/login/ \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"${DOCKERHUB_USERNAME}\",\"password\":\"${DOCKERHUB_TOKEN}\"}") || {
        print_warning "Docker Hub 登录失败，跳过介绍同步"
        return 0
      }

    jwt_token=$(printf '%s' "$login_response" | node --input-type=module -e "let raw=''; process.stdin.on('data', c => raw += c); process.stdin.on('end', () => { const json = JSON.parse(raw || '{}'); process.stdout.write(json.token || json.access_token || ''); });")
    if [ -z "$jwt_token" ]; then
        print_warning "未获取到 Docker Hub JWT，跳过介绍同步"
        return 0
    fi

    local payload_file
    payload_file=$(mktemp)

    SHORT_DESCRIPTION="$short_description" OVERVIEW_FILE="$overview_file" node --input-type=module <<'EOF' > "$payload_file"
import fs from 'fs';
const description = process.env.SHORT_DESCRIPTION || '';
const fullDescription = fs.readFileSync(process.env.OVERVIEW_FILE, 'utf8');
process.stdout.write(JSON.stringify({
  description,
  full_description: fullDescription,
}));
EOF

    if curl -fsSL -X PATCH "https://hub.docker.com/v2/repositories/${repository}/" \
      -H "Authorization: JWT ${jwt_token}" \
      -H "Content-Type: application/json" \
      --data @"$payload_file" > /dev/null; then
        print_success "Docker Hub 仓库介绍已同步"
    else
        print_warning "Docker Hub 仓库介绍同步失败（镜像已推送，不影响发布）"
    fi

    rm -f "$payload_file"
}

# 镜像名称和仓库地址
REGISTRY="${IMAGE_REGISTRY:-docker.io}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-lynx}"
LATEST_TAG="latest"

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${SCRIPT_DIR}/.env"
LOCAL_ENV_FILE="${SCRIPT_DIR}/.env.local"

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-$(read_env_value DOCKERHUB_USERNAME "$LOCAL_ENV_FILE")}"
DOCKERHUB_TOKEN="${DOCKERHUB_TOKEN:-$(read_env_value DOCKERHUB_TOKEN "$LOCAL_ENV_FILE")}"

IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-$(read_env_value IMAGE_NAMESPACE "$LOCAL_ENV_FILE")}"
if [ -z "$IMAGE_NAMESPACE" ] && [ -n "$DOCKERHUB_USERNAME" ]; then
    IMAGE_NAMESPACE="$DOCKERHUB_USERNAME"
fi

DOCKERHUB_DESCRIPTION_SYNC="${DOCKERHUB_DESCRIPTION_SYNC:-$(read_env_value DOCKERHUB_DESCRIPTION_SYNC "$ENV_FILE")}"
DOCKERHUB_REPOSITORY="${DOCKERHUB_REPOSITORY:-$(read_env_value DOCKERHUB_REPOSITORY "$ENV_FILE")}"
DOCKERHUB_SHORT_DESCRIPTION="${DOCKERHUB_SHORT_DESCRIPTION:-$(read_env_value DOCKERHUB_SHORT_DESCRIPTION "$ENV_FILE")}"
DOCKERHUB_OVERVIEW_FILE="${DOCKERHUB_OVERVIEW_FILE:-$(read_env_value DOCKERHUB_OVERVIEW_FILE "$ENV_FILE")}"

# ============================================
# 步骤 0: 选择版本类型
# ============================================
TOTAL_STEPS=5

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         L¥NX 构建部署脚本                  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

print_step "0" "$TOTAL_STEPS" "选择版本类型"

echo "请选择构建类型:"
echo "  1) 正常版本 (校验版本号)"
echo "  2) Beta 版本 (不校验版本号)"
echo ""

while true; do
    echo -n "请输入选项 (1/2): "
    read VERSION_TYPE
    case $VERSION_TYPE in
        1)
            IS_BETA_VERSION=false
            print_info "已选择：正常版本"
            break
            ;;
        2)
            IS_BETA_VERSION=true
            print_info "已选择：Beta 版本"
            break
            ;;
        *)
            print_error "无效选项，请输入 1 或 2"
            ;;
    esac
done
echo ""

# ============================================
# 步骤 1: 获取版本信息
# ============================================
print_step "1" "$TOTAL_STEPS" "配置发布信息"

# 从 .env 获取上一个版本号
LATEST_VERSION=""
if [ -f "$ENV_FILE" ] && grep -q "^APP_VERSION=" "$ENV_FILE"; then
    LATEST_VERSION=$(grep "^APP_VERSION=" "$ENV_FILE" | cut -d'=' -f2)
fi

if [ -n "$IMAGE_NAMESPACE" ]; then
    print_success "当前命名空间：$IMAGE_NAMESPACE"
fi
if [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "latest" ]; then
    print_success "当前版本号：$LATEST_VERSION"
fi

echo ""
echo -n "请输入 Docker Hub namespace"
if [ -n "$IMAGE_NAMESPACE" ]; then
    echo -n " (默认：$IMAGE_NAMESPACE)"
fi
echo -n ": "
read IMAGE_NAMESPACE_INPUT
IMAGE_NAMESPACE="${IMAGE_NAMESPACE_INPUT:-$IMAGE_NAMESPACE}"

if [ -z "$IMAGE_NAMESPACE" ]; then
    print_error "Docker Hub namespace 不能为空"
    exit 1
fi

IMAGE_NAME="${IMAGE_NAMESPACE}/${IMAGE_REPOSITORY}"
print_info "镜像目标：${REGISTRY}/${IMAGE_NAME}"
echo ""

echo -n "请输入版本号"
if [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "latest" ] && [ "$IS_BETA_VERSION" = false ]; then
    echo -n " (必须大于或等于 $LATEST_VERSION)"
fi
echo -n " (默认：${LATEST_VERSION:-0.0.1}): "
read VERSION_TAG_INPUT
VERSION_TAG_BASE=${VERSION_TAG_INPUT:-${LATEST_VERSION:-"0.0.1"}}

# 版本号校验
if [ "$IS_BETA_VERSION" = false ] && [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "latest" ]; then
    if [ "$(printf '%s\n' "$LATEST_VERSION" "$VERSION_TAG_BASE" | sort -V | head -n 1)" != "$LATEST_VERSION" ]; then
        print_error "版本号必须大于或等于 $LATEST_VERSION！当前输入：$VERSION_TAG_BASE"
        exit 1
    fi
    print_success "版本号校验通过：$VERSION_TAG_BASE >= $LATEST_VERSION"
fi

# 最终版本号
if [ "$IS_BETA_VERSION" = true ]; then
    VERSION_TAG="beta-${VERSION_TAG_BASE}-$(date +%Y%m%d-%H%M%S)"
else
    VERSION_TAG="${VERSION_TAG_BASE}"
fi

print_info "最终版本号：${VERSION_TAG}"
echo ""

# ============================================
# 步骤 2: 构建 Docker 镜像
# ============================================
print_step "2" "$TOTAL_STEPS" "构建 Docker 镜像"

cd "$PROJECT_ROOT"

echo "检查并配置 buildx..."
if ! docker buildx inspect mybuilder > /dev/null 2>&1; then
    print_info "创建新的 buildx 构建器..."
    docker buildx create --name mybuilder --use --driver docker-container --bootstrap
else
    docker buildx use mybuilder
fi

print_info "开始构建镜像..."
print_info "IMAGE: ${REGISTRY}/${IMAGE_NAME}:${VERSION_TAG}"

TAGS="-t ${REGISTRY}/${IMAGE_NAME}:${VERSION_TAG}"

docker buildx build \
  --build-arg "APP_VERSION=${VERSION_TAG}" \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -f docker/Dockerfile \
  ${TAGS} \
  --push .

if [ $? -eq 0 ]; then
    print_success "版本镜像构建并推送成功：${VERSION_TAG}"
else
    print_error "镜像构建失败!"
    exit 1
fi
echo ""

# ============================================
# 步骤 3: 同步 Docker Hub 介绍
# ============================================
print_step "3" "$TOTAL_STEPS" "同步 Docker Hub 介绍"

SYNC_ENABLED=$(printf '%s' "${DOCKERHUB_DESCRIPTION_SYNC:-false}" | tr '[:upper:]' '[:lower:]')
SYNC_REPOSITORY="${DOCKERHUB_REPOSITORY:-${IMAGE_NAME}}"
SYNC_SHORT_DESCRIPTION="${DOCKERHUB_SHORT_DESCRIPTION:-Lynx 投资组合跟踪与扭亏计划系统}"
SYNC_OVERVIEW_FILE="${DOCKERHUB_OVERVIEW_FILE:-README.md}"
SYNC_OVERVIEW_PATH="${PROJECT_ROOT}/${SYNC_OVERVIEW_FILE#./}"

if [[ "$SYNC_ENABLED" =~ ^(1|true|yes|y)$ ]]; then
    sync_dockerhub_description "$SYNC_REPOSITORY" "$SYNC_SHORT_DESCRIPTION" "$SYNC_OVERVIEW_PATH"
else
    print_warning "未启用 Docker Hub 介绍同步（设置 DOCKERHUB_DESCRIPTION_SYNC=true 可开启）"
fi

echo ""

# ============================================
# 步骤 4: 处理 latest 标签
# ============================================
print_step "4" "$TOTAL_STEPS" "处理 latest 标签"

if [ "$IS_BETA_VERSION" = false ]; then
    print_info "当前版本标签已推送：${VERSION_TAG}"
    echo -n "是否同步推送 latest 标签？(Y/n): "
    read CONFIRM_LATEST
    CONFIRM_LATEST=${CONFIRM_LATEST:-"Y"}

    if [[ "$CONFIRM_LATEST" =~ ^[Yy]$ ]]; then
        print_info "正在同步 latest -> ${VERSION_TAG}"
        docker buildx imagetools create \
          -t ${REGISTRY}/${IMAGE_NAME}:${LATEST_TAG} \
          ${REGISTRY}/${IMAGE_NAME}:${VERSION_TAG}

        if [ $? -eq 0 ]; then
            print_success "latest 标签已同步"
        else
            print_error "latest 标签同步失败!"
            exit 1
        fi
    else
        print_warning "已跳过 latest 标签同步"
    fi
else
    print_warning "Beta 版本不推送 latest 标签"
fi

echo ""

# ============================================
# 步骤 5: 更新版本号
# ============================================
print_step "5" "$TOTAL_STEPS" "更新版本号"

upsert_env_value APP_VERSION "${VERSION_TAG_BASE}" "$ENV_FILE"
upsert_env_value IMAGE_NAMESPACE "${IMAGE_NAMESPACE}" "$LOCAL_ENV_FILE"
print_success "版本号已写入: docker/.env → APP_VERSION=${VERSION_TAG_BASE}"
print_success "命名空间已记忆: docker/.env.local → IMAGE_NAMESPACE=${IMAGE_NAMESPACE}"

echo ""

# ============================================
# 完成
# ============================================
print_step "✓" "$TOTAL_STEPS" "构建完成"
print_success "所有步骤已完成!"
print_info "版本类型：$([ "$IS_BETA_VERSION" = true ] && echo "Beta 版本" || echo "正常版本")"
print_info "镜像命名空间：${IMAGE_NAMESPACE}"
print_info "镜像仓库：${IMAGE_REPOSITORY}"
print_info "最终版本号：${VERSION_TAG}"
if [ "$IS_BETA_VERSION" = false ]; then
    print_info "latest 同步状态：$([[ "${CONFIRM_LATEST:-Y}" =~ ^[Yy]$ ]] && echo "已同步" || echo "未同步")"
else
    print_info "latest 同步状态：Beta 版本已跳过"
fi
echo ""
print_info "部署方式：cd docker && docker compose pull && docker compose up -d"
echo ""
print_success "🎉 完成！"
echo ""
