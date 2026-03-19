/**
 * Pro Image Editor - 专业图像编辑器
 * 核心功能实现
 */

class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.tempCanvas = document.getElementById('tempCanvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        
        this.layers = [];
        this.currentLayer = 0;
        this.history = [];
        this.historyIndex = -1;
        
        this.currentTool = 'move';
        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        
        this.brushSize = 10;
        this.brushHardness = 100;
        this.primaryColor = '#000000';
        this.secondaryColor = '#ffffff';
        
        this.zoom = 1;
        this.selection = null;
        this.clipboard = null;
        
        this.init();
    }

    init() {
        this.createNewCanvas(800, 600);
        this.setupEventListeners();
        this.setupTools();
        this.saveHistory('新建画布');
    }

    createNewCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.tempCanvas.width = width;
        this.tempCanvas.height = height;
        
        // 创建白色背景图层
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = width;
        layerCanvas.height = height;
        const layerCtx = layerCanvas.getContext('2d');
        layerCtx.fillStyle = '#ffffff';
        layerCtx.fillRect(0, 0, width, height);
        
        this.layers = [{
            name: '背景',
            canvas: layerCanvas,
            ctx: layerCtx,
            visible: true,
            opacity: 1,
            blendMode: 'normal'
        }];
        
        this.currentLayer = 0;
        this.render();
        this.updateCanvasSize();
    }

    setupEventListeners() {
        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseout', (e) => this.handleMouseUp(e));
        
        // 滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey) {
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                this.setZoom(this.zoom * delta);
            }
        });
        
        // 文件输入
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        
        // 颜色选择器
        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.primaryColor = e.target.value;
            document.getElementById('colorHex').textContent = e.target.value;
        });
        
        // 画笔设置
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeValue').textContent = this.brushSize;
            this.updateBrushPreview();
        });
        
        document.getElementById('brushHardness').addEventListener('input', (e) => {
            this.brushHardness = parseInt(e.target.value);
            document.getElementById('brushHardnessValue').textContent = this.brushHardness;
        });
        
        // 调整滑块
        ['brightness', 'contrast', 'saturation', 'hue'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                document.getElementById(id + 'Value').textContent = e.target.value;
            });
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 文字输入
        document.getElementById('textInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.commitText();
            } else if (e.key === 'Escape') {
                this.cancelText();
            }
        });
    }

    setupTools() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                this.updateToolDisplay();
            });
        });
    }

    updateToolDisplay() {
        const toolNames = {
            'move': '移动工具',
            'rect-select': '矩形选框',
            'ellipse-select': '椭圆选框',
            'lasso': '套索工具',
            'brush': '画笔工具',
            'eraser': '橡皮擦',
            'bucket': '油漆桶',
            'text': '文字工具',
            'crop': '裁剪工具',
            'eyedropper': '吸管工具',
            'zoom': '缩放工具'
        };
        document.getElementById('currentTool').textContent = toolNames[this.currentTool] || this.currentTool;
        
        // 显示/隐藏画笔设置面板
        document.getElementById('brushPanel').style.display = 
            (this.currentTool === 'brush' || this.currentTool === 'eraser') ? 'block' : 'none';
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / this.zoom,
            y: (e.clientY - rect.top) / this.zoom
        };
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;
        
        this.isDrawing = true;
        this.startPos = this.getMousePos(e);
        this.currentPos = this.startPos;
        
        switch (this.currentTool) {
            case 'brush':
            case 'eraser':
                this.startDrawing();
                break;
            case 'bucket':
                this.fillBucket(this.startPos);
                break;
            case 'eyedropper':
                this.pickColor(this.startPos);
                break;
            case 'text':
                this.startTextInput(this.startPos);
                break;
            case 'rect-select':
            case 'ellipse-select':
                this.startSelection();
                break;
        }
    }

    handleMouseMove(e) {
        this.currentPos = this.getMousePos(e);
        
        // 更新坐标显示
        document.getElementById('cursorPos').textContent = 
            `X: ${Math.round(this.currentPos.x)}, Y: ${Math.round(this.currentPos.y)}`;
        
        if (!this.isDrawing) return;
        
        switch (this.currentTool) {
            case 'brush':
            case 'eraser':
                this.draw(e);
                break;
            case 'rect-select':
            case 'ellipse-select':
            case 'lasso':
                this.updateSelection();
                break;
            case 'crop':
                this.updateCrop();
                break;
        }
    }

    handleMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        switch (this.currentTool) {
            case 'rect-select':
            case 'ellipse-select':
                this.finalizeSelection();
                break;
            case 'brush':
            case 'eraser':
                this.saveHistory(this.currentTool === 'brush' ? '画笔' : '橡皮擦');
                break;
        }
        
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    }

    // ==================== 绘图工具 ====================
    
    startDrawing() {
        const layer = this.layers[this.currentLayer];
        layer.ctx.beginPath();
        layer.ctx.moveTo(this.startPos.x, this.startPos.y);
        layer.ctx.lineCap = 'round';
        layer.ctx.lineJoin = 'round';
        layer.ctx.lineWidth = this.brushSize;
        
        if (this.currentTool === 'eraser') {
            layer.ctx.globalCompositeOperation = 'destination-out';
        } else {
            layer.ctx.globalCompositeOperation = 'source-over';
            layer.ctx.strokeStyle = this.primaryColor;
        }
    }

    draw(e) {
        const layer = this.layers[this.currentLayer];
        layer.ctx.lineTo(this.currentPos.x, this.currentPos.y);
        layer.ctx.stroke();
        this.render();
    }

    fillBucket(pos) {
        // 简化的填充实现
        const layer = this.layers[this.currentLayer];
        const imageData = layer.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const targetColor = this.hexToRgb(this.primaryColor);
        
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        
        const startIdx = (y * width + x) * 4;
        const startR = data[startIdx];
        const startG = data[startIdx + 1];
        const startB = data[startIdx + 2];
        const startA = data[startIdx + 3];
        
        // 如果点击的颜色和填充色相同，不填充
        if (startR === targetColor.r && startG === targetColor.g && 
            startB === targetColor.b && startA === 255) return;
        
        // 使用简单的扫描线填充算法
        const stack = [[x, y]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const idx = (cy * width + cx) * 4;
            
            if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
            if (visited.has(`${cx},${cy}`)) continue;
            
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (r !== startR || g !== startG || b !== startB || a !== startA) continue;
            
            visited.add(`${cx},${cy}`);
            data[idx] = targetColor.r;
            data[idx + 1] = targetColor.g;
            data[idx + 2] = targetColor.b;
            data[idx + 3] = 255;
            
            stack.push([cx + 1, cy]);
            stack.push([cx - 1, cy]);
            stack.push([cx, cy + 1]);
            stack.push([cx, cy - 1]);
        }
        
        layer.ctx.putImageData(imageData, 0, 0);
        this.render();
        this.saveHistory('油漆桶填充');
    }

    pickColor(pos) {
        const layer = this.layers[this.currentLayer];
        const imageData = layer.ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1);
        const data = imageData.data;
        const color = this.rgbToHex(data[0], data[1], data[2]);
        
        this.primaryColor = color;
        document.getElementById('colorPicker').value = color;
        document.getElementById('colorHex').textContent = color;
    }

    startTextInput(pos) {
        const overlay = document.getElementById('textInputOverlay');
        const input = document.getElementById('textInput');
        
        overlay.style.display = 'block';
        overlay.style.left = (pos.x * this.zoom) + 'px';
        overlay.style.top = (pos.y * this.zoom) + 'px';
        input.value = '';
        input.style.color = this.primaryColor;
        input.focus();
        
        this.textPos = pos;
    }

    commitText() {
        const input = document.getElementById('textInput');
        const text = input.value;
        
        if (text) {
            const layer = this.layers[this.currentLayer];
            layer.ctx.font = '24px Arial';
            layer.ctx.fillStyle = this.primaryColor;
            layer.ctx.fillText(text, this.textPos.x, this.textPos.y + 20);
            this.render();
            this.saveHistory('添加文字');
        }
        
        this.cancelText();
    }

    cancelText() {
        document.getElementById('textInputOverlay').style.display = 'none';
        document.getElementById('textInput').value = '';
    }

    // ==================== 选区工具 ====================
    
    startSelection() {
        this.selection = {
            type: this.currentTool,
            start: { ...this.startPos },
            end: { ...this.startPos }
        };
    }

    updateSelection() {
        if (!this.selection) return;
        
        this.selection.end = { ...this.currentPos };
        
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        this.tempCtx.strokeStyle = '#0078d4';
        this.tempCtx.lineWidth = 2;
        this.tempCtx.setLineDash([5, 5]);
        
        const x = Math.min(this.selection.start.x, this.selection.end.x);
        const y = Math.min(this.selection.start.y, this.selection.end.y);
        const w = Math.abs(this.selection.end.x - this.selection.start.x);
        const h = Math.abs(this.selection.end.y - this.selection.start.y);
        
        if (this.selection.type === 'rect-select') {
            this.tempCtx.strokeRect(x, y, w, h);
        } else if (this.selection.type === 'ellipse-select') {
            this.tempCtx.beginPath();
            this.tempCtx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2);
            this.tempCtx.stroke();
        }
    }

    finalizeSelection() {
        if (!this.selection) return;
        
        const x = Math.min(this.selection.start.x, this.selection.end.x);
        const y = Math.min(this.selection.start.y, this.selection.end.y);
        const w = Math.abs(this.selection.end.x - this.selection.start.x);
        const h = Math.abs(this.selection.end.y - this.selection.start.y);
        
        this.selection.bounds = { x, y, width: w, height: h };
    }

    // ==================== 图像调整 ====================
    
    applyAdjustments() {
        const brightness = parseInt(document.getElementById('brightness').value);
        const contrast = parseInt(document.getElementById('contrast').value);
        const saturation = parseInt(document.getElementById('saturation').value);
        const hue = parseInt(document.getElementById('hue').value);
        
        const layer = this.layers[this.currentLayer];
        const imageData = layer.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // 亮度
            if (brightness !== 0) {
                r += brightness * 2.55;
                g += brightness * 2.55;
                b += brightness * 2.55;
            }
            
            // 对比度
            if (contrast !== 0) {
                const factor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;
            }
            
            // 饱和度
            if (saturation !== 0) {
                const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                const satFactor = 1 + saturation / 100;
                r = gray + (r - gray) * satFactor;
                g = gray + (g - gray) * satFactor;
                b = gray + (b - gray) * satFactor;
            }
            
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
        
        layer.ctx.putImageData(imageData, 0, 0);
        this.render();
        this.saveHistory('图像调整');
        
        // 重置滑块
        ['brightness', 'contrast', 'saturation', 'hue'].forEach(id => {
            document.getElementById(id).value = 0;
            document.getElementById(id + 'Value').textContent = '0';
        });
    }

    // ==================== 滤镜 ====================
    
    applyFilter(filterType) {
        const layer = this.layers[this.currentLayer];
        const imageData = layer.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        switch (filterType) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
                break;
                
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
                
            case 'invert':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                break;
                
            case 'blur':
                this.convolutionFilter(data, width, height, [
                    1/9, 1/9, 1/9,
                    1/9, 1/9, 1/9,
                    1/9, 1/9, 1/9
                ]);
                break;
                
            case 'sharpen':
                this.convolutionFilter(data, width, height, [
                    0, -1, 0,
                    -1, 5, -1,
                    0, -1, 0
                ]);
                break;
                
            case 'edge':
                this.convolutionFilter(data, width, height, [
                    -1, -1, -1,
                    -1, 8, -1,
                    -1, -1, -1
                ]);
                break;
                
            case 'emboss':
                this.convolutionFilter(data, width, height, [
                    -2, -1, 0,
                    -1, 1, 1,
                    0, 1, 2
                ]);
                break;
        }
        
        layer.ctx.putImageData(imageData, 0, 0);
        this.render();
        this.saveHistory('应用滤镜: ' + filterType);
    }

    convolutionFilter(data, width, height, kernel) {
        const side = Math.round(Math.sqrt(kernel.length));
        const halfSide = Math.floor(side / 2);
        const src = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;
                
                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = y + cy - halfSide;
                        const scx = x + cx - halfSide;
                        
                        if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
                            const srcOff = (scy * width + scx) * 4;
                            const wt = kernel[cy * side + cx];
                            r += src[srcOff] * wt;
                            g += src[srcOff + 1] * wt;
                            b += src[srcOff + 2] * wt;
                        }
                    }
                }
                
                const dstOff = (y * width + x) * 4;
                data[dstOff] = r;
                data[dstOff + 1] = g;
                data[dstOff + 2] = b;
            }
        }
    }

    // ==================== 图层操作 ====================
    
    newLayer() {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = this.canvas.width;
        layerCanvas.height = this.canvas.height;
        
        const layer = {
            name: `图层 ${this.layers.length}`,
            canvas: layerCanvas,
            ctx: layerCanvas.getContext('2d'),
            visible: true,
            opacity: 1,
            blendMode: 'normal'
        };
        
        this.layers.push(layer);
        this.currentLayer = this.layers.length - 1;
        this.updateLayersPanel();
        this.render();
        this.saveHistory('新建图层');
    }

    deleteLayer() {
        if (this.layers.length <= 1) {
            alert('不能删除最后一个图层');
            return;
        }
        
        this.layers.splice(this.currentLayer, 1);
        this.currentLayer = Math.max(0, this.currentLayer - 1);
        this.updateLayersPanel();
        this.render();
        this.saveHistory('删除图层');
    }

    duplicateLayer() {
        const sourceLayer = this.layers[this.currentLayer];
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = this.canvas.width;
        layerCanvas.height = this.canvas.height;
        
        const layerCtx = layerCanvas.getContext('2d');
        layerCtx.drawImage(sourceLayer.canvas, 0, 0);
        
        const layer = {
            name: `${sourceLayer.name} 副本`,
            canvas: layerCanvas,
            ctx: layerCtx,
            visible: true,
            opacity: sourceLayer.opacity,
            blendMode: sourceLayer.blendMode
        };
        
        this.layers.splice(this.currentLayer + 1, 0, layer);
        this.currentLayer++;
        this.updateLayersPanel();
        this.render();
        this.saveHistory('复制图层');
    }

    mergeDown() {
        if (this.currentLayer >= this.layers.length - 1) return;
        
        const current = this.layers[this.currentLayer];
        const below = this.layers[this.currentLayer + 1];
        
        below.ctx.globalAlpha = current.opacity;
        below.ctx.drawImage(current.canvas, 0, 0);
        below.ctx.globalAlpha = 1;
        
        this.layers.splice(this.currentLayer, 1);
        this.updateLayersPanel();
        this.render();
        this.saveHistory('向下合并');
    }

    mergeAll() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.canvas.width;
        mergedCanvas.height = this.canvas.height;
        const mergedCtx = mergedCanvas.getContext('2d');
        
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.visible) {
                mergedCtx.globalAlpha = layer.opacity;
                mergedCtx.drawImage(layer.canvas, 0, 0);
            }
        }
        
        this.layers = [{
            name: '合并',
            canvas: mergedCanvas,
            ctx: mergedCtx,
            visible: true,
            opacity: 1,
            blendMode: 'normal'
        }];
        
        this.currentLayer = 0;
        this.updateLayersPanel();
        this.render();
        this.saveHistory('合并所有图层');
    }

    updateLayersPanel() {
        const list = document.getElementById('layersList');
        list.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            const item = document.createElement('div');
            item.className = 'layer-item' + (index === this.currentLayer ? ' active' : '');
            item.innerHTML = `
                <span class="layer-visibility" onclick="editor.toggleLayerVisibility(${index})">${layer.visible ? '👁' : '🚫'}</span>
                <span class="layer-name">${layer.name}</span>
                <input type="text" class="layer-opacity" value="${Math.round(layer.opacity * 100)}%" 
                       onchange="editor.setLayerOpacity(${index}, this.value)">
            `;
            item.onclick = (e) => {
                if (!e.target.classList.contains('layer-visibility') && 
                    !e.target.classList.contains('layer-opacity')) {
                    this.currentLayer = index;
                    this.updateLayersPanel();
                }
            };
            list.appendChild(item);
        });
    }

    toggleLayerVisibility(index) {
        this.layers[index].visible = !this.layers[index].visible;
        this.updateLayersPanel();
        this.render();
    }

    setLayerOpacity(index, value) {
        const opacity = parseInt(value) / 100;
        this.layers[index].opacity = isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
        this.render();
    }

    // ==================== 渲染 ====================
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.visible) {
                this.ctx.globalAlpha = layer.opacity;
                this.ctx.drawImage(layer.canvas, 0, 0);
            }
        }
        
        this.ctx.globalAlpha = 1;
    }

    // ==================== 历史记录 ====================
    
    saveHistory(action) {
        // 删除当前位置之后的历史
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // 保存当前状态
        const state = this.layers.map(layer => ({
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            imageData: layer.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
        }));
        
        this.history.push({ action, state, currentLayer: this.currentLayer });
        this.historyIndex++;
        
        // 限制历史记录数量
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateHistoryPanel();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreHistory();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistory();
        }
    }

    restoreHistory() {
        const record = this.history[this.historyIndex];
        
        this.layers = record.state.map(layerData => {
            const canvas = document.createElement('canvas');
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(layerData.imageData, 0, 0);
            
            return {
                name: layerData.name,
                canvas: canvas,
                ctx: ctx,
                visible: layerData.visible,
                opacity: layerData.opacity,
                blendMode: layerData.blendMode
            };
        });
        
        this.currentLayer = record.currentLayer;
        this.updateLayersPanel();
        this.render();
        this.updateHistoryPanel();
    }

    updateHistoryPanel() {
        const list = document.getElementById('historyList');
        list.innerHTML = '';
        
        this.history.forEach((record, index) => {
            const item = document.createElement('div');
            item.className = 'history-item' + (index === this.historyIndex ? ' current' : '');
            item.textContent = record.action;
            item.onclick = () => {
                this.historyIndex = index;
                this.restoreHistory();
            };
            list.appendChild(item);
        });
    }

    // ==================== 文件操作 ====================
    
    fileNew() {
        document.getElementById('newImageDialog').classList.add('show');
    }

    createNewImage() {
        const width = parseInt(document.getElementById('newWidth').value) || 800;
        const height = parseInt(document.getElementById('newHeight').value) || 600;
        this.createNewCanvas(width, height);
        this.saveHistory('新建图像');
        closeDialog('newImageDialog');
    }

    fileOpen() {
        document.getElementById('fileInput').click();
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.createNewCanvas(img.width, img.height);
                this.layers[0].ctx.drawImage(img, 0, 0);
                this.render();
                this.saveHistory('打开图像');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    fileSave() {
        // 保存为项目文件（JSON格式，包含图层信息）
        const project = {
            width: this.canvas.width,
            height: this.canvas.height,
            layers: this.layers.map(layer => ({
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                data: layer.canvas.toDataURL()
            }))
        };
        
        const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
        this.downloadFile(blob, 'project.pie');
    }

    fileExport() {
        // 导出为 PNG
        const link = document.createElement('a');
        link.download = 'image.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    downloadFile(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ==================== 变换操作 ====================
    
    rotateLeft() {
        this.rotateCanvas(-90);
    }

    rotateRight() {
        this.rotateCanvas(90);
    }

    rotateCanvas(degrees) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        if (Math.abs(degrees) === 90) {
            tempCanvas.width = this.canvas.height;
            tempCanvas.height = this.canvas.width;
        } else {
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
        }
        
        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        tempCtx.rotate(degrees * Math.PI / 180);
        tempCtx.drawImage(this.canvas, -this.canvas.width / 2, -this.canvas.height / 2);
        
        this.createNewCanvas(tempCanvas.width, tempCanvas.height);
        this.layers[0].ctx.drawImage(tempCanvas, 0, 0);
        this.render();
        this.saveHistory(`旋转 ${degrees}°`);
    }

    flipHorizontal() {
        this.flipCanvas(true, false);
    }

    flipVertical() {
        this.flipCanvas(false, true);
    }

    flipCanvas(horizontal, vertical) {
        const layer = this.layers[this.currentLayer];
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.translate(
            horizontal ? tempCanvas.width : 0,
            vertical ? tempCanvas.height : 0
        );
        tempCtx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
        tempCtx.drawImage(layer.canvas, 0, 0);
        
        layer.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        layer.ctx.drawImage(tempCanvas, 0, 0);
        this.render();
        this.saveHistory(horizontal ? '水平翻转' : '垂直翻转');
    }

    // ==================== 辅助功能 ====================
    
    handleKeyDown(e) {
        // 撤销/重做
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
        
        // 文件操作
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            this.fileOpen();
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.fileSave();
        } else if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.fileNew();
        }
        
        // 工具快捷键
        const toolKeys = {
            'v': 'move',
            'm': 'rect-select',
            'l': 'lasso',
            'b': 'brush',
            'e': 'eraser',
            't': 'text',
            'c': 'crop',
            'i': 'eyedropper',
            'z': 'zoom'
        };
        
        if (toolKeys[e.key.toLowerCase()] && !e.ctrlKey) {
            const tool = toolKeys[e.key.toLowerCase()];
            document.querySelector(`[data-tool="${tool}"]`).click();
        }
    }

    setZoom(value) {
        this.zoom = Math.max(0.1, Math.min(5, value));
        this.canvas.style.transform = `scale(${this.zoom})`;
        this.tempCanvas.style.transform = `scale(${this.zoom})`;
        document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
    }

    updateCanvasSize() {
        document.getElementById('canvasSize').textContent = 
            `${this.canvas.width} x ${this.canvas.height} px`;
    }

    updateBrushPreview() {
        const preview = document.getElementById('brushPreviewCircle');
        preview.style.width = this.brushSize + 'px';
        preview.style.height = this.brushSize + 'px';
        preview.style.background = this.primaryColor;
    }

    // ==================== 工具函数 ====================
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
}

// 初始化编辑器
const editor = new ImageEditor();

// ==================== 全局函数 ====================

function fileNew() { editor.fileNew(); }
function fileOpen() { editor.fileOpen(); }
function fileSave() { editor.fileSave(); }
function fileExport() { editor.fileExport(); }
function createNewImage() { editor.createNewImage(); }

function undo() { editor.undo(); }
function redo() { editor.redo(); }
function cut() { /* 实现剪切 */ }
function copy() { /* 实现复制 */ }
function paste() { /* 实现粘贴 */ }
function selectAll() { /* 实现全选 */ }
function deselect() { editor.selection = null; editor.tempCtx.clearRect(0, 0, editor.tempCanvas.width, editor.tempCanvas.height); }

function adjustBrightness() { /* 打开亮度调整对话框 */ }
function adjustHue() { /* 打开色相调整对话框 */ }
function adjustLevels() { /* 打开色阶对话框 */ }
function applyAdjustments() { editor.applyAdjustments(); }

function rotateLeft() { editor.rotateLeft(); }
function rotateRight() { editor.rotateRight(); }
function flipHorizontal() { editor.flipHorizontal(); }
function flipVertical() { editor.flipVertical(); }
function crop() { editor.currentTool = 'crop'; document.querySelector('[data-tool="crop"]').click(); }
function resize() { /* 打开调整大小对话框 */ }

function applyFilter(filter) { editor.applyFilter(filter); }

function newLayer() { editor.newLayer(); }
function duplicateLayer() { editor.duplicateLayer(); }
function deleteLayer() { editor.deleteLayer(); }
function mergeDown() { editor.mergeDown(); }
function mergeAll() { editor.mergeAll(); }

function showShortcuts() {
    alert(`快捷键列表：
Ctrl+N - 新建
Ctrl+O - 打开
Ctrl+S - 保存
Ctrl+E - 导出
Ctrl+Z - 撤销
Ctrl+Y - 重做

工具快捷键：
V - 移动工具
M - 选框工具
L - 套索工具
B - 画笔工具
E - 橡皮擦
T - 文字工具
C - 裁剪工具
I - 吸管工具
Z - 缩放工具`);
}

function showAbout() {
    alert('Pro Image Editor v1.0\n专业图像编辑器\n\n基于 HTML5 Canvas 开发');
}

function closeDialog(id) {
    document.getElementById(id).classList.remove('show');
}

// 更新画笔预览
editor.updateBrushPreview();
