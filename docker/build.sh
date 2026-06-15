#!/bin/bash
# 投资罗盘 Docker 构建脚本 (使用 buildx 多平台构建)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

IMAGE_NAME="invest-compass"

# 读取当前最新版本
ENV_FILE="${SCRIPT_DIR}/.env"
CURRENT_VERSION=""
if [[ -f "$ENV_FILE" ]] && grep -q "^APP_VERSION=" "$ENV_FILE"; then
  CURRENT_VERSION=$(grep "^APP_VERSION=" "$ENV_FILE" | cut -d'=' -f2)
fi

# 版本号：优先使用环境变量，否则交互式输入
if [[ -n "$APP_VERSION" ]]; then
  VERSION="$APP_VERSION"
else
  if [[ -n "$CURRENT_VERSION" && "$CURRENT_VERSION" != "latest" ]]; then
    echo "📌 当前最新版本: ${CURRENT_VERSION}"
  fi
  read -p "📋 请输入版本号 (直接回车使用 latest): " VERSION
  VERSION="${VERSION:-latest}"
fi
TAG="$VERSION"

# 版本号校验：新版本不能小于当前版本
version_compare() {
  # 比较两个语义化版本号，返回: 0=相等, 1=v1>v2, 2=v1<v2
  local v1="$1" v2="$2"
  if [[ "$v1" == "$v2" ]]; then return 0; fi
  local IFS=.
  local i v1_parts=($v1) v2_parts=($v2)
  for ((i=0; i<${#v1_parts[@]} || i<${#v2_parts[@]}; i++)); do
    local n1="${v1_parts[i]:-0}" n2="${v2_parts[i]:-0}"
    if ((n1 > n2)); then return 1; fi
    if ((n1 < n2)); then return 2; fi
  done
  return 0
}

if [[ -n "$CURRENT_VERSION" && "$CURRENT_VERSION" != "latest" && "$VERSION" != "latest" ]]; then
  version_compare "$VERSION" "$CURRENT_VERSION"
  cmp_result=$?
  if [[ $cmp_result -eq 2 ]]; then
    echo "❌ 错误: 新版本 ${VERSION} 小于当前版本 ${CURRENT_VERSION}"
    read -p "确认要降级构建吗？[y/N] " FORCE
    if [[ ! "$FORCE" =~ ^[Yy]$ ]]; then
      echo "⏭️  已取消"
      exit 1
    fi
  fi
fi

# 官方镜像仓库地址
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
REGISTRY_REPO="fooololo"
FULL_IMAGE="${REGISTRY}/${REGISTRY_REPO}/${IMAGE_NAME}"

# 目标平台（单平台用 docker driver，多平台需 docker-container driver）
PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

# 判断是否多平台（包含逗号）
if [[ "$PLATFORM" == *","* ]]; then
  # 多平台需要 docker-container driver
  BUILDER_NAME="invest-compass-builder"
  if docker buildx inspect "$BUILDER_NAME" &>/dev/null; then
    docker buildx use "$BUILDER_NAME"
  else
    echo "🔧 首次创建多平台 builder: ${BUILDER_NAME}"
    docker buildx create --name "$BUILDER_NAME" --use --driver docker-container --bootstrap
  fi
  MULTI_PLATFORM=true
else
  # 单平台直接用默认 builder（docker driver，无需拉镜像）
  docker buildx use default 2>/dev/null || true
  MULTI_PLATFORM=false
fi

echo ""
echo "🏗️  目标平台: ${PLATFORM}"
echo ""

# 询问是否推送到官方仓库
echo "📦 目标镜像: ${FULL_IMAGE}:${TAG}"
read -p "构建并推送到官方仓库？[y/N] " CONFIRM

if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
  if [[ "$MULTI_PLATFORM" == "true" ]]; then
    # 多平台：必须用 --push 直接推送（不支持 --load）
    TAGS="--tag ${FULL_IMAGE}:${TAG}"
    if [[ "$TAG" != "latest" ]]; then
      TAGS="${TAGS} --tag ${FULL_IMAGE}:latest"
    fi

    echo ""
    echo "🔨 多平台构建并推送 ${FULL_IMAGE}:${TAG} ..."
    docker buildx build -f docker/Dockerfile \
      --platform "${PLATFORM}" \
      --build-arg APP_VERSION="${VERSION}" \
      ${TAGS} \
      --push .
  else
    # 单平台：先 load 到本地，再 push（使用默认 builder，速度快）
    echo ""
    echo "🔨 构建 ${FULL_IMAGE}:${TAG} ..."
    docker buildx build -f docker/Dockerfile \
      --platform "${PLATFORM}" \
      --build-arg APP_VERSION="${VERSION}" \
      --tag "${FULL_IMAGE}:${TAG}" \
      --load .

    echo "📤 推送 ${FULL_IMAGE}:${TAG} ..."
    docker push "${FULL_IMAGE}:${TAG}"

    if [[ "$TAG" != "latest" ]]; then
      docker tag "${FULL_IMAGE}:${TAG}" "${FULL_IMAGE}:latest"
      docker push "${FULL_IMAGE}:latest"
    fi
  fi

  echo ""
  echo "✅ 构建并推送完成: ${FULL_IMAGE}:${TAG}"
else
  # 仅构建到本地
  echo ""
  echo "🔨 构建镜像到本地 ${IMAGE_NAME}:${TAG} ..."
  docker buildx build -f docker/Dockerfile \
    --platform "${PLATFORM}" \
    --build-arg APP_VERSION="${VERSION}" \
    --tag "${IMAGE_NAME}:${TAG}" \
    --load .

  echo ""
  echo "✅ 构建完成: ${IMAGE_NAME}:${TAG}"
fi

# 构建成功后，回写版本号到 docker/.env
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^APP_VERSION=" "$ENV_FILE"; then
    sed -i '' "s/^APP_VERSION=.*/APP_VERSION=${VERSION}/" "$ENV_FILE"
  else
    echo "APP_VERSION=${VERSION}" >> "$ENV_FILE"
  fi
else
  echo "APP_VERSION=${VERSION}" > "$ENV_FILE"
fi
echo "📝 版本号已写入: docker/.env → APP_VERSION=${VERSION}"

echo ""
echo "运行方式："
echo "  cd docker && docker compose up -d"
echo ""
echo "或直接运行："
echo "  docker run -d --name invest-compass -p 3456:3456 -v \$(pwd)/data:/app/data ${IMAGE_NAME}:${TAG}"
