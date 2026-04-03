/**
 * 象棋相机 - 主应用逻辑
 */

(function() {
    // ===== 状态管理 =====
    const state = {
        screen: 'splash',      // 当前屏幕
        playerSide: 'red',     // 玩家执红/黑
        aiLevel: 2,            // AI难度 1-3
        gameMode: 'camera',    // camera/manual
        
        board: null,           // 当前棋盘
        isRedTurn: true,       // 当前轮到红方
        selectedPos: null,     // 选中的棋子位置
        validMoves: [],        // 当前可走位置
        lastMove: null,        // 上一步走法
        moveHistory: [],       // 走棋历史
        
        isGameOver: false,
        isAIThinking: false,
        capturedPieces: { red: [], black: [] }
    };

    // ===== DOM 元素 =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const screens = {
        splash: $('#splash-screen'),
        setup: $('#setup-screen'),
        game: $('#game-screen')
    };

    const modals = {
        camera: $('#camera-modal'),
        menu: $('#menu-modal'),
        about: $('#about-modal')
    };

    // ===== 初始化 =====
    function init() {
        // 初始化棋盘
        ChessBoard.init($('#board-canvas'));
        
        // 初始化摄像头模块
        CameraModule.init($('#camera-video'), $('#camera-canvas'));
        
        // 绑定事件
        bindEvents();
        
        // 显示启动页
        showScreen('splash');
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        // 启动页
        $('#btn-start').onclick = () => showScreen('setup');

        // 设置页
        $$('.radio-label').forEach(el => {
            el.onclick = () => {
                el.parentElement.querySelectorAll('.radio-label').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                state.playerSide = el.dataset.value;
            };
        });

        $$('.diff-btn').forEach(el => {
            el.onclick = () => {
                $$('.diff-btn').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                state.aiLevel = parseInt(el.dataset.level);
            };
        });

        $$('.mode-btn').forEach(el => {
            el.onclick = () => {
                $$('.mode-btn').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                state.gameMode = el.dataset.mode;
            };
        });

        $('#btn-go').onclick = startGame;

        // 棋盘交互
        const boardCanvas = $('#board-canvas');
        boardCanvas.onclick = handleBoardClick;
        boardCanvas.ontouchend = (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            handleBoardClick({ clientX: touch.clientX, clientY: touch.clientY });
        };

        // 工具栏
        $('#btn-camera').onclick = openCamera;
        $('#btn-undo').onclick = undoMove;
        $('#btn-hint').onclick = showHint;
        $('#btn-restart').onclick = () => {
            if (confirm('确定要重新开始吗？')) {
                startGame();
            }
        };
        $('#btn-menu').onclick = () => showModal('menu');

        // 摄像头模态框
        $('#close-camera').onclick = closeCamera;
        $('#btn-capture').onclick = captureAndRecognize;
        $('#btn-retake').onclick = () => {
            $('#recognition-result').style.display = 'none';
            CameraModule.startCamera();
        };
        $('#btn-apply').onclick = applyRecognizedBoard;

        // 菜单
        $('#close-menu').onclick = () => hideModal('menu');
        $('#menu-new').onclick = () => {
            hideModal('menu');
            showScreen('setup');
        };
        $('#menu-flip').onclick = () => {
            ChessBoard.setFlipped(!ChessBoard.isFlipped());
            renderBoard();
            hideModal('menu');
        };
        $('#menu-init').onclick = () => {
            state.board = ChessRules.getInitialBoard();
            state.isRedTurn = true;
            state.moveHistory = [];
            state.lastMove = null;
            state.selectedPos = null;
            state.isGameOver = false;
            renderBoard();
            updateUI();
            hideModal('menu');
            toast('已恢复初始局面');
        };
        $('#menu-empty').onclick = () => {
            state.board = Array(10).fill(null).map(() => Array(9).fill(0));
            state.selectedPos = null;
            state.isGameOver = false;
            renderBoard();
            hideModal('menu');
            toast('棋盘已清空');
        };
        $('#menu-about').onclick = () => {
            hideModal('menu');
            showModal('about');
        };

        // 关于
        $('#close-about').onclick = () => hideModal('about');

        // 窗口大小变化
        window.addEventListener('resize', () => {
            ChessBoard.resize();
            renderBoard();
        });
    }

    // ===== 屏幕切换 =====
    function showScreen(name) {
        state.screen = name;
        Object.keys(screens).forEach(key => {
            screens[key].classList.toggle('active', key === name);
        });
    }

    // ===== 模态框 =====
    function showModal(name) {
        modals[name].classList.add('show');
    }

    function hideModal(name) {
        modals[name].classList.remove('show');
    }

    // ===== 开始游戏 =====
    function startGame() {
        // 设置AI难度
        ChessAI.setDifficulty(state.aiLevel);
        
        // 初始化棋盘
        state.board = ChessRules.getInitialBoard();
        state.isRedTurn = true;
        state.selectedPos = null;
        state.validMoves = [];
        state.lastMove = null;
        state.moveHistory = [];
        state.isGameOver = false;
        state.capturedPieces = { red: [], black: [] };
        
        // 设置棋盘方向（玩家的棋在下方）
        ChessBoard.setFlipped(state.playerSide === 'black');
        
        // 更新UI
        updatePlayerNames();
        
        // 切换到游戏屏幕
        showScreen('game');
        
        // 渲染棋盘
        setTimeout(() => {
            ChessBoard.resize();
            renderBoard();
            updateUI();
            
            // 如果玩家执黑，AI先走
            if (state.playerSide === 'black') {
                setTimeout(() => aiMove(), 500);
            }
        }, 100);
    }

    // ===== 更新玩家名称 =====
    function updatePlayerNames() {
        const isPlayerRed = state.playerSide === 'red';
        $('#red-name').textContent = isPlayerRed ? '你' : 'AI';
        $('#black-name').textContent = isPlayerRed ? 'AI' : '你';
    }

    // ===== 渲染棋盘 =====
    function renderBoard() {
        // 检查是否被将军
        let checkPos = null;
        if (ChessRules.isInCheck(state.board, state.isRedTurn)) {
            // 找将/帅位置
            const kingPiece = state.isRedTurn ? ChessRules.PIECES.R_KING : ChessRules.PIECES.B_KING;
            for (let r = 0; r < 10; r++) {
                for (let c = 0; c < 9; c++) {
                    if (state.board[r][c] === kingPiece) {
                        checkPos = [r, c];
                        break;
                    }
                }
                if (checkPos) break;
            }
        }

        ChessBoard.render(state.board, {
            selectedPos: state.selectedPos,
            lastMove: state.lastMove,
            validMoves: state.validMoves,
            checkPos
        });
    }

    // ===== 更新UI =====
    function updateUI() {
        // 更新状态
        const statusEl = $('#game-status');
        if (state.isGameOver) {
            statusEl.textContent = '游戏结束';
        } else if (state.isAIThinking) {
            statusEl.textContent = 'AI思考中...';
        } else {
            statusEl.textContent = state.isRedTurn ? '红方走棋' : '黑方走棋';
        }

        // 更新走棋记录
        const historyList = $('#history-list');
        historyList.innerHTML = state.moveHistory.map((move, i) => {
            const text = ChessRules.moveToText(move, state.board);
            const colorClass = ChessRules.isRed(move.piece) ? 'red' : 'black';
            return `<span class="move-item ${colorClass}">${Math.floor(i/2) + 1}.${text}</span>`;
        }).join('');
        historyList.scrollTop = historyList.scrollHeight;

        // 更新操作提示
        const hintEl = $('#action-hint');
        if (state.isGameOver) {
            hintEl.textContent = '点击"重来"开始新游戏';
        } else if (isPlayerTurn()) {
            if (state.gameMode === 'camera') {
                hintEl.textContent = '点击棋子走棋，或拍照识别对手走法';
            } else {
                hintEl.textContent = '点击棋子选择，再点击目标位置走棋';
            }
        } else {
            hintEl.textContent = 'AI正在思考...';
        }
    }

    // ===== 是否轮到玩家 =====
    function isPlayerTurn() {
        if (state.playerSide === 'red') {
            return state.isRedTurn;
        } else {
            return !state.isRedTurn;
        }
    }

    // ===== 棋盘点击处理 =====
    function handleBoardClick(e) {
        if (state.isGameOver || state.isAIThinking) return;
        
        const pos = ChessBoard.pixelToBoard(e.clientX, e.clientY);
        if (!pos) return;

        const [row, col] = pos;
        const piece = state.board[row][col];

        // 如果已选中棋子
        if (state.selectedPos) {
            // 点击可走位置
            const targetMove = state.validMoves.find(m => 
                m.to[0] === row && m.to[1] === col
            );
            
            if (targetMove) {
                // 执行走棋
                executeMove(targetMove);
                return;
            }
            
            // 点击己方其他棋子
            if (piece !== 0 && 
                ((state.isRedTurn && ChessRules.isRed(piece)) || 
                 (!state.isRedTurn && ChessRules.isBlack(piece)))) {
                selectPiece(row, col);
                return;
            }
            
            // 取消选中
            state.selectedPos = null;
            state.validMoves = [];
            renderBoard();
            return;
        }

        // 选中己方棋子
        if (piece !== 0) {
            const isOwnPiece = (state.isRedTurn && ChessRules.isRed(piece)) ||
                              (!state.isRedTurn && ChessRules.isBlack(piece));
            
            // 只有轮到玩家时才能选子
            if (isOwnPiece && isPlayerTurn()) {
                selectPiece(row, col);
            }
        }
    }

    // ===== 选中棋子 =====
    function selectPiece(row, col) {
        state.selectedPos = [row, col];
        
        // 生成可走位置
        const allMoves = ChessRules.generateMoves(state.board, state.isRedTurn);
        state.validMoves = allMoves.filter(m => 
            m.from[0] === row && m.from[1] === col
        );
        
        renderBoard();
    }

    // ===== 执行走棋 =====
    function executeMove(move) {
        // 记录被吃的棋子
        if (move.captured) {
            if (ChessRules.isRed(move.captured)) {
                state.capturedPieces.red.push(move.captured);
            } else {
                state.capturedPieces.black.push(move.captured);
            }
        }

        // 更新棋盘
        state.board = ChessRules.makeMove(state.board, move);
        state.moveHistory.push(move);
        state.lastMove = move;
        state.selectedPos = null;
        state.validMoves = [];
        
        // 切换回合
        state.isRedTurn = !state.isRedTurn;
        
        renderBoard();
        updateUI();

        // 检查游戏结束
        if (checkGameEnd()) {
            return;
        }

        // AI走棋
        if (!isPlayerTurn()) {
            setTimeout(() => aiMove(), 300);
        }
    }

    // ===== AI走棋 =====
    async function aiMove() {
        if (state.isGameOver) return;

        state.isAIThinking = true;
        $('#thinking-overlay').classList.add('show');
        updateUI();

        // AI计算
        const isAIRed = state.playerSide === 'black';
        const move = await ChessAI.getBestMoveAsync(state.board, isAIRed);

        state.isAIThinking = false;
        $('#thinking-overlay').classList.remove('show');

        if (move) {
            executeMove(move);
        } else {
            // AI无子可走
            checkGameEnd();
        }
    }

    // ===== 检查游戏结束 =====
    function checkGameEnd() {
        if (ChessRules.isCheckmate(state.board, state.isRedTurn)) {
            state.isGameOver = true;
            const winner = state.isRedTurn ? '黑方' : '红方';
            const isPlayerWin = (winner === '红方' && state.playerSide === 'red') ||
                               (winner === '黑方' && state.playerSide === 'black');
            
            setTimeout(() => {
                showGameOver(isPlayerWin ? '恭喜你赢了！' : 'AI获胜', isPlayerWin);
            }, 500);
            return true;
        }
        return false;
    }

    // ===== 显示游戏结束 =====
    function showGameOver(message, isWin) {
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        overlay.innerHTML = `
            <div class="game-over-content">
                <div class="result-icon">${isWin ? '🎉' : '😔'}</div>
                <h2>${message}</h2>
                <p>${isWin ? '太厉害了！公园大爷输给你了！' : '再接再厉，下次一定能赢！'}</p>
                <div class="game-over-actions">
                    <button class="btn-secondary" id="go-back">返回</button>
                    <button class="btn-primary" id="play-again">再来一局</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#go-back').onclick = () => {
            overlay.remove();
            showScreen('setup');
        };
        overlay.querySelector('#play-again').onclick = () => {
            overlay.remove();
            startGame();
        };
    }

    // ===== 悔棋 =====
    function undoMove() {
        if (state.moveHistory.length < 2) {
            toast('无法悔棋');
            return;
        }
        if (state.isAIThinking) {
            toast('AI思考中，请稍候');
            return;
        }

        // 悔两步（玩家和AI各一步）
        for (let i = 0; i < 2; i++) {
            const move = state.moveHistory.pop();
            if (move) {
                // 恢复棋盘
                state.board[move.from[0]][move.from[1]] = move.piece;
                state.board[move.to[0]][move.to[1]] = move.captured || 0;
            }
        }

        state.lastMove = state.moveHistory[state.moveHistory.length - 1] || null;
        state.selectedPos = null;
        state.validMoves = [];
        state.isGameOver = false;

        // 确保轮到玩家
        state.isRedTurn = state.playerSide === 'red';

        renderBoard();
        updateUI();
        toast('已悔棋');
    }

    // ===== 提示 =====
    function showHint() {
        if (state.isGameOver || state.isAIThinking || !isPlayerTurn()) {
            return;
        }

        const hint = ChessAI.getHint(state.board, state.isRedTurn);
        if (hint) {
            state.selectedPos = hint.from;
            state.validMoves = [hint];
            renderBoard();
            toast(`建议：${ChessRules.moveToText(hint, state.board)}`);
        }
    }

    // ===== 摄像头功能 =====
    async function openCamera() {
        showModal('camera');
        $('#recognition-result').style.display = 'none';
        
        const success = await CameraModule.startCamera();
        if (!success) {
            toast('无法访问摄像头，请检查权限设置');
        }
    }

    function closeCamera() {
        CameraModule.stopCamera();
        hideModal('camera');
    }

    async function captureAndRecognize() {
        const photo = CameraModule.capturePhoto();
        if (!photo) {
            toast('拍照失败，请重试');
            return;
        }

        CameraModule.stopCamera();
        toast('正在识别棋盘...');

        try {
            const result = await CameraModule.recognizeBoard(photo);
            
            if (result.success) {
                window.recognizedBoard = result.board;
                
                // 显示识别结果
                const preview = $('#recognition-preview');
                preview.innerHTML = '棋盘识别完成<br>置信度: ' + (result.confidence * 100).toFixed(0) + '%<br>' +
                                   '<small style="color:#999;">' + result.message + '</small>';
                
                $('#recognition-result').style.display = 'block';
            } else {
                toast('识别失败: ' + result.message);
                CameraModule.startCamera();
            }
        } catch (error) {
            console.error('识别错误:', error);
            toast('识别出错，请重试');
            CameraModule.startCamera();
        }
    }

    function applyRecognizedBoard() {
        if (window.recognizedBoard) {
            state.board = window.recognizedBoard;
            state.selectedPos = null;
            state.validMoves = [];
            state.moveHistory = [];
            state.lastMove = null;
            state.isGameOver = false;
            
            // 默认红方先走
            state.isRedTurn = true;
            
            renderBoard();
            updateUI();
            closeCamera();
            toast('已应用识别的局面');
            
            // 如果不是玩家回合，AI走棋
            if (!isPlayerTurn()) {
                setTimeout(() => aiMove(), 500);
            }
        }
    }

    // ===== Toast提示 =====
    function toast(message, duration = 2000) {
        const toastEl = $('#toast');
        toastEl.textContent = message;
        toastEl.classList.add('show');
        
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, duration);
    }

    // ===== 启动应用 =====
    document.addEventListener('DOMContentLoaded', init);
})();
