// ==UserScript==
// @name         DS导出Md
// @namespace    
// @version      1.0
// @description  将DeepSeek网页端的AI对话导出为Markdown格式文件
// @author       CPrograme
// @match        https://chat.deepseek.com/*
// @grant        GM_download
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 添加导出按钮样式
    const style = document.createElement('style');
    style.textContent = `
        .ds-export-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            z-index: 10000;
            white-space: nowrap;
        }
        .ds-export-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
        }
        .ds-export-btn:active {
            transform: translateY(0);
        }
        .ds-export-btn svg {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }
        .ds-export-btn.exporting {
            opacity: 0.7;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // 获取对话标题
    function getConversationTitle() {
        // 尝试从页面标题获取
        const titleElement = document.querySelector('title');
        if (titleElement) {
            let title = titleElement.textContent.replace(' - DeepSeek', '').trim();
            if (title && title !== 'DeepSeek') return title;
        }
        
        // 从对话列表的当前活跃项获取
        const activeItem = document.querySelector('._546d736.b64fb9ae .c08e6e93');
        if (activeItem) return activeItem.textContent.trim();
        
        // 从页面顶部标题获取
        const headerTitle = document.querySelector('.d00ed9c9');
        if (headerTitle) return headerTitle.textContent.trim();
        
        return 'DeepSeek对话';
    }

    // 提取对话内容
    function extractConversation() {
        const messages = [];
        const title = getConversationTitle();
        
        // 查找所有消息项
        const messageItems = document.querySelectorAll('[data-virtual-list-item-key]');
        
        if (messageItems.length === 0) {
            console.error('未找到对话消息');
            return null;
        }

        messageItems.forEach(item => {
            // 用户消息
            const userMessage = item.querySelector('.fbb737a4');
            if (userMessage) {
                const text = userMessage.textContent.trim();
                if (text) {
                    messages.push({
                        role: 'user',
                        content: text
                    });
                }
            }

            // AI回复消息
            const aiMessage = item.querySelector('.ds-markdown');
            if (aiMessage) {
                // 获取完整的Markdown内容（包括HTML格式）
                const content = extractMarkdownContent(aiMessage);
                if (content) {
                    messages.push({
                        role: 'assistant',
                        content: content
                    });
                }
            }
        });

        return { title, messages };
    }

    // 提取Markdown内容（保留格式）
    function extractMarkdownContent(element) {
        let markdown = '';
        
        // 处理所有子元素
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            
            // 段落
            if (child.classList.contains('ds-markdown-paragraph')) {
                const text = getParagraphText(child);
                if (text) markdown += text + '\n\n';
            }
            // 标题
            else if (child.tagName === 'H1') {
                markdown += '# ' + child.textContent.trim() + '\n\n';
            }
            else if (child.tagName === 'H2') {
                markdown += '## ' + child.textContent.trim() + '\n\n';
            }
            else if (child.tagName === 'H3') {
                markdown += '### ' + child.textContent.trim() + '\n\n';
            }
            // 有序列表
            else if (child.tagName === 'OL') {
                const items = child.querySelectorAll('li');
                items.forEach((li, index) => {
                    const text = getListItemText(li);
                    if (text) markdown += `${index + 1}. ${text}\n`;
                });
                markdown += '\n';
            }
            // 无序列表
            else if (child.tagName === 'UL') {
                const items = child.querySelectorAll('li');
                items.forEach(li => {
                    const text = getListItemText(li);
                    if (text) markdown += `- ${text}\n`;
                });
                markdown += '\n';
            }
            // 代码块
            else if (child.classList.contains('md-code-block')) {
                markdown += extractCodeBlock(child) + '\n\n';
            }
            // 引用块
            else if (child.tagName === 'BLOCKQUOTE') {
                const text = child.textContent.trim();
                if (text) {
                    markdown += '> ' + text.replace(/\n/g, '\n> ') + '\n\n';
                }
            }
        }

        return markdown.trim();
    }

    // 获取段落文本（处理内联格式）
    function getParagraphText(element) {
        let text = '';
        
        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'STRONG' || node.tagName === 'B') {
                    text += '**' + node.textContent + '**';
                } else if (node.tagName === 'EM' || node.tagName === 'I') {
                    text += '*' + node.textContent + '*';
                } else if (node.tagName === 'CODE') {
                    text += '`' + node.textContent + '`';
                } else if (node.tagName === 'BR') {
                    text += '\n';
                } else if (node.tagName === 'A') {
                    text += node.textContent;
                } else if (node.classList && node.classList.contains('ds-markdown-cite')) {
                    // 跳过引用标记
                } else {
                    // 递归处理子节点
                    for (const child of node.childNodes) {
                        processNode(child);
                    }
                }
            }
        };

        for (const child of element.childNodes) {
            processNode(child);
        }

        return text.trim();
    }

    // 获取列表项文本
    function getListItemText(element) {
        // 列表项中可能包含段落
        const paragraph = element.querySelector('.ds-markdown-paragraph');
        if (paragraph) {
            return getParagraphText(paragraph);
        }
        return element.textContent.trim();
    }

    // 提取代码块
    function extractCodeBlock(element) {
        const pre = element.querySelector('pre');
        if (!pre) return '';
        
        // 获取语言标识
        const langElement = element.querySelector('.d813de27');
        const language = langElement ? langElement.textContent.trim() : '';
        
        // 获取代码内容
        const codeLines = pre.querySelectorAll('span');
        let code = '';
        codeLines.forEach(line => {
            code += line.textContent + '\n';
        });
        
        return '```' + language + '\n' + code.trim() + '\n```';
    }

    // 格式化为Markdown
    function formatAsMarkdown(title, messages) {
        let markdown = `# ${title}\n\n`;
        markdown += `> 导出时间: ${new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })}\n\n`;
        markdown += `---\n\n`;

        messages.forEach((msg, index) => {
            if (msg.role === 'user') {
                markdown += `## 👤 用户\n\n`;
            } else if (msg.role === 'assistant') {
                markdown += `## 🤖 DeepSeek\n\n`;
            }
            
            markdown += msg.content + '\n\n';
            
            if (index < messages.length - 1) {
                markdown += `---\n\n`;
            }
        });

        return markdown;
    }

    // 导出对话
    function exportConversation(button) {
        if (button) {
            button.classList.add('exporting');
            button.textContent = '导出中...';
        }

        try {
            const result = extractConversation();
            
            if (!result || result.messages.length === 0) {
                GM_notification({
                    text: '未能提取到对话内容，请确保页面已加载完成且有对话',
                    title: '导出失败',
                    timeout: 3000
                });
                if (button) {
                    button.classList.remove('exporting');
                    button.innerHTML = createButtonContent();
                }
                return;
            }

            const content = formatAsMarkdown(result.title, result.messages);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            // 清理文件名中的非法字符
            const safeTitle = result.title.replace(/[\\/:*?"<>|]/g, '_');
            const filename = `${safeTitle}-${timestamp}.md`;

            // 使用GM_download下载文件
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            GM_download({
                url: url,
                name: filename,
                saveAs: true
            });

            // 清理URL对象
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            GM_notification({
                text: `对话"${result.title}"已成功导出为Markdown格式`,
                title: '导出成功 ',
                timeout: 3000
            });

            if (button) {
                button.classList.remove('exporting');
                button.innerHTML = createButtonContent();
            }
        } catch (error) {
            console.error('导出失败:', error);
            GM_notification({
                text: '导出过程中出现错误: ' + error.message,
                title: '导出失败 ',
                timeout: 3000
            });
            if (button) {
                button.classList.remove('exporting');
                button.innerHTML = createButtonContent();
            }
        }
    }

    // 创建按钮HTML内容
    function createButtonContent() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            导出Markdown
        `;
    }

    // 创建导出按钮
    function createExportButton() {
        const button = document.createElement('button');
        button.className = 'ds-export-btn';
        button.innerHTML = createButtonContent();
        button.title = '导出当前对话为Markdown文件';
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            exportConversation(button);
        });

        return button;
    }

    // 初始化
    function init() {
        console.log('DeepSeek对话导出助手已启动 (Markdown专用版)');
        
        // 创建浮动按钮
        const floatButton = createExportButton();
        floatButton.style.position = 'fixed';
        floatButton.style.bottom = '100px';
        floatButton.style.right = '20px';
        floatButton.style.zIndex = '9999';
        document.body.appendChild(floatButton);
        
        console.log('导出按钮已添加到页面右下角');
    }

    // 启动脚本
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
