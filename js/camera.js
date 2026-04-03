/**
 * 摄像头和实时视频模块
 */

const CameraModule = (function() {
    let video = null;
    let canvas = null;
    let ctx = null;
    let stream = null;
    let isStreaming = false;

    // 初始化
    function init(videoEl, canvasEl) {
        video = videoEl;
        if (canvasEl) {
            canvas = canvasEl;
            ctx = canvas.getContext('2d');
        }
    }

    // 打开摄像头（实时视频流）
    async function startCamera(options = {}) {
        try {
            const constraints = {
                video: {
                    facingMode: options.facingMode || { ideal: 'environment' },
                    width: { ideal: options.width || 1280 },
                    height: { ideal: options.height || 720 }
                },
                audio: false
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            
            return new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    isStreaming = true;
                    resolve(true);
                };
            });
        } catch (error) {
            console.error('摄像头启动失败:', error);
            
            // 尝试降级方案
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: false 
                });
                video.srcObject = stream;
                await video.play();
                isStreaming = true;
                return true;
            } catch (e) {
                console.error('所有摄像头启动失败:', e);
                return false;
            }
        }
    }

    // 关闭摄像头
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (video) {
            video.srcObject = null;
        }
        isStreaming = false;
    }

    // 拍照（从视频流中截取一帧）
    function captureFrame() {
        if (!video || video.readyState !== 4) {
            return null;
        }
        
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        return {
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            width: canvas.width,
            height: canvas.height
        };
    }

    // 实时获取视频帧（用于连续分析）
    function getVideoFrame() {
        if (!video || video.readyState !== 4) {
            return null;
        }
        return video;
    }

    // 检查是否正在运行
    function isRunning() {
        return isStreaming;
    }

    // 切换前后摄像头
    async function switchCamera() {
        const currentFacing = stream?.getVideoTracks()[0]?.getSettings()?.facingMode;
        stopCamera();
        
        const newFacing = currentFacing === 'environment' ? 'user' : 'environment';
        return await startCamera({ facingMode: newFacing });
    }

    // 模拟棋盘识别（实际应用需要真正的图像处理）
    // 在真实项目中，这里应该使用：
    // 1. TensorFlow.js + 训练好的模型
    // 2. OpenCV.js 进行图像处理
    // 3. 调用后端 AI 服务
    function recognizeBoard(imageData) {
        return new Promise((resolve) => {
            console.log('分析棋盘图像...');
            
            // 模拟识别延迟
            setTimeout(() => {
                // 返回识别结果
                // 实际应用中应该返回从图像中识别出的棋盘状态
                resolve({
                    success: true,
                    board: null, // null 表示使用当前棋盘状态
                    confidence: 0.85,
                    message: '识别完成（演示模式）',
                    detectedMove: null // 检测到的走法变化
                });
            }, 500);
        });
    }

    // 检测棋盘变化（对比两帧之间的差异）
    function detectBoardChange(prevBoard, currentBoard) {
        if (!prevBoard || !currentBoard) return null;
        
        const changes = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (prevBoard[r][c] !== currentBoard[r][c]) {
                    changes.push({
                        row: r,
                        col: c,
                        from: prevBoard[r][c],
                        to: currentBoard[r][c]
                    });
                }
            }
        }
        
        // 分析变化，推断走法
        if (changes.length === 2) {
            const empty = changes.find(c => c.to === 0);
            const filled = changes.find(c => c.from === 0 || c.to !== 0);
            if (empty && filled) {
                return {
                    from: [empty.row, empty.col],
                    to: [filled.row, filled.col],
                    piece: empty.from,
                    captured: filled.from !== 0 ? filled.from : 0
                };
            }
        }
        
        return null;
    }

    return {
        init,
        startCamera,
        stopCamera,
        captureFrame,
        getVideoFrame,
        isRunning,
        switchCamera,
        recognizeBoard,
        detectBoardChange
    };
})();
