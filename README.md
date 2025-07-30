# Recipe Producer - 食谱生成器

一个基于 Web 的食谱生成器，用于批量创建和管理结构化的食谱 JSON 文件。

## 功能特点

- ✨ 批量创建多个食谱
- 📝 结构化的表单输入
- 🖼️ 图片上传和管理
- 📊 实时 JSON 预览
- 💾 自动保存到本地存储
- 📦 批量下载为 ZIP 文件
- 🎯 支持多标签页编辑

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务器

```bash
npm start
```

服务器将在 http://localhost:3000 启动

### 开发模式

```bash
npm run dev
```

使用 nodemon 自动重启服务器

## 使用说明

### 1. 创建食谱

1. 打开浏览器访问 http://localhost:3000
2. 填写食谱基本信息：
   - 标题（必填）
   - 类别
   - 用例描述
   - DSP 版本

### 2. 添加步骤

1. 点击"添加步骤"按钮
2. 为每个步骤：
   - 输入步骤名称
   - 添加配置项（字段/值对）
   - 上传相关图片
   - 添加图片替代文本

### 3. 上传图片

- 点击图片上传区域或拖拽图片到上传区
- 支持的格式：JPEG, JPG, PNG, GIF, WebP
- 最大文件大小：10MB

### 4. 批量管理

- 使用顶部标签页切换不同食谱
- 点击"+"添加新食谱
- 点击"×"删除食谱（至少保留一个）

### 5. 生成和下载

1. 点击"保存当前食谱"保存单个食谱
2. 点击"生成并下载所有食谱"批量生成
3. 系统将生成包含所有食谱的 ZIP 文件

## 输出格式

生成的 ZIP 文件结构：
```
recipes-batch-[timestamp].zip
├── recipe-1/
│   ├── recipe.json
│   └── images/
│       └── [上传的图片]
├── recipe-2/
│   ├── recipe.json
│   └── images/
└── ...
```

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript
- **后端**：Node.js + Express
- **文件处理**：Multer
- **压缩**：Archiver

## API 端点

- `POST /api/session/create` - 创建新会话
- `POST /api/upload` - 上传图片
- `POST /api/recipe/save` - 保存单个食谱
- `POST /api/batch/generate` - 批量生成食谱
- `GET /api/batch/download/:sessionId` - 下载 ZIP 文件
- `GET /api/session/:sessionId/cleanup` - 清理会话文件

## 注意事项

- 数据自动保存到浏览器本地存储
- 刷新页面会恢复之前的工作
- 下载完成后可选择清理临时文件
- 建议使用 Chrome 或基于 Chromium 的浏览器

## License

ISC