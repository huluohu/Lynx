#!/bin/bash
# 投资罗盘 Docker 构建脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

IMAGE_NAME="invest-compass"
TAG="${1:-latest}"

echo "🔨 构建镜像 ${IMAGE_NAME}:${TAG} ..."
docker build -f docker/Dockerfile -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "✅ 构建完成: ${IMAGE_NAME}:${TAG}"
echo ""
echo "运行方式："
echo "  cd docker && docker compose up -d"
echo ""
echo "或直接运行："
echo "  docker run -d --name invest-compass -p 3456:3456 -v \$(pwd)/data:/app/data ${IMAGE_NAME}:${TAG}"
