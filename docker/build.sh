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

# 镜像名称和仓库地址
REGISTRY="docker.io"
IMAGE_NAME="fooololo/lynx"
LATEST_TAG="latest"

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================
# 步骤 0: 选择版本类型
# ============================================
TOTAL_STEPS=4

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
print_step "1" "$TOTAL_STEPS" "配置版本信息"

# 从 .env 获取上一个版本号
ENV_FILE="${SCRIPT_DIR}/.env"
LATEST_VERSION=""
if [ -f "$ENV_FILE" ] && grep -q "^APP_VERSION=" "$ENV_FILE"; then
    LATEST_VERSION=$(grep "^APP_VERSION=" "$ENV_FILE" | cut -d'=' -f2)
fi

if [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "latest" ]; then
    print_success "当前版本号：$LATEST_VERSION"
fi

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
# 步骤 3: 处理 latest 标签
# ============================================
print_step "3" "$TOTAL_STEPS" "处理 latest 标签"

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
# 步骤 4: 更新版本号
# ============================================
print_step "4" "$TOTAL_STEPS" "更新版本号"

# 写入 .env
if [ -f "$ENV_FILE" ] && grep -q "^APP_VERSION=" "$ENV_FILE"; then
    sed -i '' "s/^APP_VERSION=.*/APP_VERSION=${VERSION_TAG_BASE}/" "$ENV_FILE"
else
    echo "APP_VERSION=${VERSION_TAG_BASE}" > "$ENV_FILE"
fi
print_success "版本号已写入: docker/.env → APP_VERSION=${VERSION_TAG_BASE}"

echo ""

# ============================================
# 完成
# ============================================
print_step "✓" "$TOTAL_STEPS" "构建完成"
print_success "所有步骤已完成!"
print_info "版本类型：$([ "$IS_BETA_VERSION" = true ] && echo "Beta 版本" || echo "正常版本")"
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
