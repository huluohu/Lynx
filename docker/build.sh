#!/bin/bash
# 投资罗盘 Docker 构建脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

IMAGE_NAME="invest-compass"
TAG="${1:-latest}"

# 官方镜像仓库地址（可通过环境变量覆盖）
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
REGISTRY_REPO="${DOCKER_REPO:-}"

echo "🔨 构建镜像 ${IMAGE_NAME}:${TAG} ..."
docker build -f docker/Dockerfile -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "✅ 构建完成: ${IMAGE_NAME}:${TAG}"
echo ""

# 询问是否推送到官方仓库
if [ -n "$REGISTRY_REPO" ]; then
  FULL_IMAGE="${REGISTRY}/${REGISTRY_REPO}/${IMAGE_NAME}:${TAG}"
else
  echo "💡 提示: 设置环境变量 DOCKER_REPO 可配置推送目标"
  echo "   例如: export DOCKER_REPO=yourname"
  echo ""
  read -p "📦 是否推送镜像到官方仓库？请输入仓库命名空间（如 yourname），直接回车跳过: " INPUT_REPO
  if [ -z "$INPUT_REPO" ]; then
    echo ""
    echo "⏭️  跳过推送"
    echo ""
    echo "运行方式："
    echo "  cd docker && docker compose up -d"
    echo ""
    echo "或直接运行："
    echo "  docker run -d --name invest-compass -p 3456:3456 -v \$(pwd)/data:/app/data ${IMAGE_NAME}:${TAG}"
    exit 0
  fi
  FULL_IMAGE="${REGISTRY}/${INPUT_REPO}/${IMAGE_NAME}:${TAG}"
fi

echo ""
echo "🏷️  目标镜像: ${FULL_IMAGE}"
read -p "确认推送？[y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "⏭️  已取消推送"
  exit 0
fi

echo ""
echo "📤 推送镜像到 ${FULL_IMAGE} ..."
docker tag "${IMAGE_NAME}:${TAG}" "${FULL_IMAGE}"
docker push "${FULL_IMAGE}"

echo ""
echo "✅ 推送完成: ${FULL_IMAGE}"
echo ""
echo "运行方式："
echo "  cd docker && docker compose up -d"
echo ""
echo "或直接运行："
echo "  docker run -d --name invest-compass -p 3456:3456 -v \$(pwd)/data:/app/data ${IMAGE_NAME}:${TAG}"
