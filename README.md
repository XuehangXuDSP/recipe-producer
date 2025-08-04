# Recipe Producer - GitHub Pages版本

这是Recipe Producer应用的纯前端版本，专为GitHub Pages部署而优化。

## 🌟 特性

- **多Recipe标签页管理** - 同时编辑多个Recipe
- **结构化JSON生成** - 按照特定schema生成Recipe JSON文件
- **图片管理** - 使用IndexedDB本地存储图片，支持拖拽上传
- **批量导出** - 使用JSZip库生成包含所有Recipe和图片的ZIP文件
- **本地存储** - 自动保存工作进度到localStorage
- **导入/导出** - 支持单个或批量导入已有的Recipe JSON文件
- **完全离线** - 无需服务器，完全在浏览器中运行

## 🚀 在线访问

访问部署在GitHub Pages上的应用：
[https://your-username.github.io/recipe-producer/](https://your-username.github.io/recipe-producer/)

## 🛠 本地开发

1. 克隆仓库：
```bash
git clone https://github.com/your-username/recipe-producer.git
cd recipe-producer
```

2. 启动本地服务器：
```bash
# 使用Python
python -m http.server 8000

# 或使用Node.js的http-server
npx http-server docs -p 8000
```

3. 在浏览器中访问：
```
http://localhost:8000
```

## 📁 文件结构

```
docs/
├── index.html          # 主页面
├── script.js           # 应用逻辑（纯前端）
├── style.css           # 样式文件
├── libs/
│   └── jszip.min.js    # JSZip库用于ZIP文件生成
└── README.md           # 说明文档
```

## 🔧 技术栈

- **前端**: 原生HTML5 + CSS3 + JavaScript (ES6+)
- **数据存储**: localStorage + IndexedDB
- **文件处理**: FileReader API + JSZip
- **图片管理**: IndexedDB for Blob storage
- **部署**: GitHub Pages静态托管

## 📋 Recipe JSON结构

应用生成的Recipe遵循以下结构：

```json
{
  "id": "recipe-title",
  "title": "Recipe Title",
  "category": "Batch|Triggers|Data List|Action Button|Data Loader",
  "DSPVersions": ["version1", "version2"],
  "usecase": "描述用例",
  "prerequisites": [
    {
      "description": "前置条件描述",
      "quickLinks": [
        {
          "title": "链接标题",
          "url": "链接地址或Recipe ID"
        }
      ]
    }
  ],
  "direction": "Current ⇒ Current",
  "connection": "连接信息",
  "walkthrough": [
    {
      "step": "步骤名称",
      "config": [
        {
          "field": "配置字段",
          "value": "配置值"
        }
      ],
      "media": [
        {
          "type": "image|video",
          "url": "images/filename.jpg",
          "alt": "替代文本"
        }
      ]
    }
  ],
  "downloadableExecutables": [
    {
      "title": "文件标题",
      "url": "文件URL"
    }
  ],
  "relatedRecipes": [
    {
      "title": "相关Recipe标题",
      "url": "相关Recipe URL"
    }
  ],
  "keywords": ["关键词1", "关键词2"]
}
```

## 🎯 主要功能

### 1. 多标签页Recipe编辑
- 支持同时编辑多个Recipe
- 标签页可拖拽排序
- 自动保存当前编辑状态

### 2. 图片管理
- 拖拽上传图片到各个步骤
- 图片存储在IndexedDB中
- 生成ZIP时自动包含所有图片

### 3. 批量操作
- 单个或批量导入Recipe JSON文件
- 一键生成并下载包含所有Recipe的ZIP文件
- ZIP包包含正确的文件夹结构和图片

### 4. 数据验证
- 自动验证Recipe JSON格式
- 必填字段检查
- 错误提示和处理

## 🔄 从原版本迁移

如果您使用的是原来的Node.js版本，可以通过以下方式迁移：

1. 导出现有的Recipe JSON文件
2. 在新版本中使用"批量上传Recipe"功能导入
3. 重新上传相关图片

## 🐛 问题排查

### 常见问题

1. **图片无法显示**
   - 检查浏览器是否支持IndexedDB
   - 清除浏览器缓存后重试

2. **ZIP文件生成失败**
   - 确保浏览器支持现代JavaScript特性
   - 检查控制台错误信息

3. **数据丢失**
   - 检查localStorage是否被清理
   - 定期导出备份Recipe文件

### 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📞 支持

如果您遇到问题或有建议，请：

1. 查看本README文档
2. 搜索已有的Issues
3. 创建新的Issue描述问题

---

⭐ 如果这个项目对您有帮助，请给它一个星标！