/**
 * 象棋相机 - 主应用逻辑 v2.0
 * 支持实时视频 + 语音指导
 */

(function() {
    // ===== 状态管理 =====
    const state = {
        screen: 'splash',
        playerSide: 'red',     // 玩家执红/黑（实际上是指大爷执哪方）
        aiLevel: 2,
        voiceEnabled: true,
        
        board: null,
        isRedTurn: true,
        selectedPos: null,
        validMoves: [],
        lastMove: null,
        moveHistory: [],
        
        isGameOver: false,
        isAIThinking: false,
        isWaitingOpponent: false,  // 等待对手走棋
        currentAdvice: '',         // 当前AI建议
        
        // 输入对手走法模式
        inputMode: false,
        inputFromPos: null
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
        menu: $('#menu-modal'),
        moveInput: $('#move-input-modal'),
        about: $('#about-modal')
    };

    // ===== 初始化 =====
    function init() {
        // 初始化各模块
        ChessBoard.init($('#board-canvas'));
        CameraModule.init($('#live-video'));
        VoiceModule.init();
        
        // 绑定事件
        bindEvents();
        
        // 显示启动页
        showScreen('splash');
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        // 启动页
        $('#btn-start').onclick = () => showScreen('setup');

        // 设置页 - 选边
        $$('.radio-label').forEach(el => {
            el.onclick = () => {
                el.parentElement.querySelectorAll('.radio-label').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                state.playerSide = el.dataset.value;
            };
        });

        // 设置页 - 难度
        $$('.diff-btn').forEach(el => {
            el.onclick = () => {
                $$('.diff-btn').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                state.aiLevel = parseInt(el.dataset.level);
            };
        });

        // 设置页 - 语音
        $$('.voice-btn').forEach(el => {
            el.onclick = () => {
                $$('.voice-btn').forEach(e => e.classList.remove('active'));
                el.classList.add('active');
                state.voiceEnabled = el.dataset.voice === 'on';
                VoiceModule.setEnabled(state.voiceEnabled);
            };
        });

        // 开始游戏
        $('#btn-go').onclick = startGame;

        // 棋盘交互
        const boardCanvas = $('#board-canvas');
        boardCanvas.onclick = handleBoardClick;
        boardCanvas.ontouchend = (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            handleBoardClick({ clientX: touch.clientX, clientY: touch.clientY });
        };

        // 工具栏按钮
        $('#btn-opponent-moved').onclick = onOpponentMoved;
        $('#btn-my-turn').onclick = requestAIAdvice;
        $('#btn-hint').onclick = showHint;
        $('#btn-undo').onclick = undoMove;
        $('#btn-menu').onclick = () => showModal('menu');

        // 语音播报按钮
        $('#btn-speak').onclick = replayAdvice;

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
        $('#menu-voice-toggle').onclick = () => {
            state.voiceEnabled = !state.voiceEnabled;
            VoiceModule.setEnabled(state.voiceEnabled);
            toast(state.voiceEnabled ? '语音已开启 🔊' : '语音已关闭 🔇');
            hideModal('menu');
        };
        $('#menu-init').onclick = () => {
            resetBoard();
            hideModal('menu');
        };
        $('#menu-manual').onclick = () => {
            hideModal('menu');
            enterManualInputMode();
        };
        $('#menu-about').onclick = () => {
            hideModal('menu');
            showModal('about');
        };

        // 手动输入走法
        $('#close-move-input').onclick = () => {
            hideModal('moveInput');
            state.inputMode = false;
        };
        $('#btn-auto-detect').onclick = autoDetectMove;
        $('#btn-skip-turn').onclick = skipOpponentTurn;

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
        
        // 离开游戏页时关闭摄像头
        if (name !== 'game' && CameraModule.isRunning()) {
            CameraModule.stopCamera();
        }
    }

    // ===== 模态框 =====
    function showModal(name) {
        modals[name]?.classList.add('show');
    }

    function hideModal(name) {
        modals[name]?.classList.remove('show');
    }

    // ===== 开始游戏 =====
    async function startGame() {
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
        state.isWaitingOpponent = false;
        state.inputMode = false;
        state.currentAdvice = '';
        
        // 切换到游戏屏幕
        showScreen('game');
        
        // 稍等UI更新
        await sleep(100);
        
        // 调整棋盘大小
        ChessBoard.resize();
        renderBoard();
        
        // 启动摄像头
        const cameraSuccess = await CameraModule.startCamera();
        if (cameraSuccess) {
            updateVideoStatus(true);
        } else {
            toast('摄像头启动失败，请检查权限');
            updateVideoStatus(false);
        }
        
        // 语音欢迎
        if (state.voiceEnabled) {
            await VoiceModule.speak('对局开始！请将手机对准棋盘。');
        }
        
        // 根据先手方给出提示
        if (state.playerSide === 'red') {
            // 你执红，你先走，给AI建议
            updateAdvice('红方先走，请走棋。走完后AI会给出应对建议。');
            setStatus('你先走（红方）');
        } else {
            // 你执黑（帮大爷走红），大爷先走
            updateAdvice('等待对手走棋...点击「对手走了」按钮后AI给出建议。');
            setStatus('等待对手（红方）');
            state.isWaitingOpponent = true;
        }
    }

    // ===== 重置棋盘 =====
    function resetBoard() {
        state.board = ChessRules.getInitialBoard();
        state.isRedTurn = true;
        state.moveHistory = [];
        state.lastMove = null;
        state.selectedPos = null;
        state.isGameOver = false;
        renderBoard();
        updateAdvice('棋盘已重置，红方先走。');
        toast('已重置棋盘');
    }

    // ===== 渲染棋盘 =====
    function renderBoard() {
        let checkPos = null;
        if (!state.isGameOver && ChessRules.isInCheck(state.board, state.isRedTurn)) {
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
    function setStatus(text) {
        $('#game-status').textContent = text;
    }

    function updateVideoStatus(active) {
        const dot = $('.status-dot');
        if (dot) {
            dot.classList.toggle('active', active);
        }
    }

    function updateAdvice(text, highlight = false) {
        state.currentAdvice = text;
        const el = $('#advice-content');
        if (highlight) {
            el.innerHTML = `<span class="highlight">${text}</span>`;
        } else {
            el.textContent = text;
        }
    }

    // ===== 语音播报 =====
    function replayAdvice() {
        if (state.currentAdvice) {
            const btn = $('#btn-speak');
            btn.classList.add('speaking');
            VoiceModule.speak(state.currentAdvice).then(() => {
                btn.classList.remove('speaking');
            });
        }
    }

    // ===== 对手走棋完成 =====
    async function onOpponentMoved() {
        if (state.isGameOver) return;
        
        // 进入手动输入模式，让用户在棋盘上输入对手的走法
        toast('请在棋盘上点击对手移动的棋子');
        state.inputMode = true;
        state.inputFromPos = null;
        state.isWaitingOpponent = true;
        setStatus('输入对手走法...');
        
        showModal('moveInput');
    }

    // ===== 手动输入对手走法 =====
    function enterManualInputMode() {
        state.inputMode = true;
        state.inputFromPos = null;
        toast('点击对手移动的棋子起点');
    }

    // ===== 自动检测走法（拍照识别） =====
    async function autoDetectMove() {
        hideModal('moveInput');
        toast('正在分析棋盘...');
        
        const frame = CameraModule.captureFrame();
        if (!frame) {
            toast('无法获取图像');
            return;
        }
        
        try {
            const result = await CameraModule.recognizeBoard(frame.imageData);
            if (result.success && result.detectedMove) {
                // 识别到了走法
                executeOpponentMove(result.detectedMove);
            } else {
                toast('未检测到走法变化，请手动输入');
                state.inputMode = true;
            }
        } catch (e) {
            console.error(e);
            toast('识别失败，请手动输入');
        }
    }

    // ===== 跳过对手回合 =====
    function skipOpponentTurn() {
        hideModal('moveInput');
        state.inputMode = false;
        state.isWaitingOpponent = false;
        
        // 切换回合
        state.isRedTurn = !state.isRedTurn;
        
        toast('已跳过，现在该你走');
        requestAIAdvice();
    }

    // ===== 棋盘点击处理 =====
    function handleBoardClick(e) {
        if (state.isGameOver || state.isAIThinking) return;
        
        const pos = ChessBoard.pixelToBoard(e.clientX, e.clientY);
        if (!pos) return;

        const [row, col] = pos;
        const piece = state.board[row][col];

        // 手动输入对手走法模式
        if (state.inputMode) {
            handleInputModeClick(row, col, piece);
            return;
        }

        // 正常选子走棋模式
        if (state.selectedPos) {
            const targetMove = state.validMoves.find(m => 
                m.to[0] === row && m.to[1] === col
            );
            
            if (targetMove) {
                executeMyMove(targetMove);
                return;
            }
            
            // 点击己方其他棋子
            if (piece !== 0 && canSelectPiece(piece)) {
                selectPiece(row, col);
                return;
            }
            
            // 取消选中
            state.selectedPos = null;
            state.validMoves = [];
            renderBoard();
            return;
        }

        // 选中棋子
        if (piece !== 0 && canSelectPiece(piece)) {
            selectPiece(row, col);
        }
    }

    // ===== 输入模式点击处理 =====
    function handleInputModeClick(row, col, piece) {
        hideModal('moveInput');
        
        if (!state.inputFromPos) {
            // 选择起点
            if (piece !== 0) {
                state.inputFromPos = [row, col];
                state.selectedPos = [row, col];
                state.validMoves = [];
                renderBoard();
                toast('现在点击目标位置');
            }
        } else {
            // 选择终点
            const from = state.inputFromPos;
            const movingPiece = state.board[from[0]][from[1]];
            const captured = state.board[row][col];
            
            const move = {
                from: from,
                to: [row, col],
                piece: movingPiece,
                captured: captured
            };
            
            executeOpponentMove(move);
            
            state.inputMode = false;
            state.inputFromPos = null;
        }
    }

    // ===== 判断能否选择棋子 =====
    function canSelectPiece(piece) {
        // 根据当前回合判断
        return (state.isRedTurn && ChessRules.isRed(piece)) ||
               (!state.isRedTurn && ChessRules.isBlack(piece));
    }

    // ===== 选中棋子 =====
    function selectPiece(row, col) {
        state.selectedPos = [row, col];
        const allMoves = ChessRules.generateMoves(state.board, state.isRedTurn);
        state.validMoves = allMoves.filter(m => 
            m.from[0] === row && m.from[1] === col
        );
        renderBoard();
    }

    // ===== 执行对手走法 =====
    async function executeOpponentMove(move) {
        // 更新棋盘
        state.board = ChessRules.makeMove(state.board, move);
        state.moveHistory.push(move);
        state.lastMove = move;
        state.selectedPos = null;
        state.validMoves = [];
        state.isWaitingOpponent = false;
        
        // 切换回合
        state.isRedTurn = !state.isRedTurn;
        
        renderBoard();
        
        // 记录走法
        addMoveToHistory(move);
        
        // 播报对手走法
        const moveText = ChessRules.moveToText(move, state.board);
        if (state.voiceEnabled) {
            await VoiceModule.speak(`对手走了${moveText}`);
        }
        
        // 检查游戏结束
        if (checkGameEnd()) return;
        
        // 请求AI建议
        requestAIAdvice();
    }

    // ===== 执行我方走法 =====
    async function executeMyMove(move) {
        // 更新棋盘
        state.board = ChessRules.makeMove(state.board, move);
        state.moveHistory.push(move);
        state.lastMove = move;
        state.selectedPos = null;
        state.validMoves = [];
        
        // 切换回合
        state.isRedTurn = !state.isRedTurn;
        
        renderBoard();
        
        // 记录走法
        addMoveToHistory(move);
        
        // 播报走法
        const moveText = ChessRules.moveToText(move, state.board);
        if (state.voiceEnabled) {
            await VoiceModule.speak(`你走${moveText}`);
        }
        
        // 检查游戏结束
        if (checkGameEnd()) return;
        
        // 等待对手
        state.isWaitingOpponent = true;
        setStatus('等待对手走棋');
        updateAdvice('等待对手走棋...走完后点击「对手走了」按钮。');
    }

    // ===== 请求AI建议 =====
    async function requestAIAdvice() {
        if (state.isGameOver) return;
        
        state.isAIThinking = true;
        setStatus('AI分析中...');
        $('#thinking-overlay').classList.add('show');
        
        try {
            // AI计算最佳走法
            const move = await ChessAI.getBestMoveAsync(state.board, state.isRedTurn);
            
            state.isAIThinking = false;
            $('#thinking-overlay').classList.remove('show');
            
            if (move) {
                const moveText = ChessRules.moveToText(move, state.board);
                const advice = `建议：${moveText}`;
                
                updateAdvice(advice, true);
                setStatus(state.isRedTurn ? '红方走棋' : '黑方走棋');
                
                // 高亮建议走法
                state.selectedPos = move.from;
                state.validMoves = [move];
                renderBoard();
                
                // 语音播报
                if (state.voiceEnabled) {
                    await VoiceModule.speakAdvice(`建议走${moveText}`);
                }
            } else {
                updateAdvice('无可用走法');
            }
        } catch (e) {
            console.error('AI计算错误:', e);
            state.isAIThinking = false;
            $('#thinking-overlay').classList.remove('show');
            updateAdvice('分析出错，请重试');
        }
    }

    // ===== 显示提示 =====
    async function showHint() {
        if (state.isGameOver || state.isAIThinking) return;
        await requestAIAdvice();
    }

    // ===== 悔棋 =====
    function undoMove() {
        if (state.moveHistory.length === 0) {
            toast('没有可撤销的走法');
            return;
        }
        if (state.isAIThinking) {
            toast('请等待AI分析完成');
            return;
        }

        // 撤销最后一步
        const move = state.moveHistory.pop();
        state.board[move.from[0]][move.from[1]] = move.piece;
        state.board[move.to[0]][move.to[1]] = move.captured || 0;
        
        state.lastMove = state.moveHistory[state.moveHistory.length - 1] || null;
        state.selectedPos = null;
        state.validMoves = [];
        state.isRedTurn = !state.isRedTurn;
        state.isGameOver = false;

        renderBoard();
        updateMoveHistory();
        toast('已撤销');
        
        // 更新建议
        updateAdvice('已撤销上一步，请继续。');
    }

    // ===== 添加走法记录 =====
    function addMoveToHistory(move) {
        const historyList = $('#history-list');
        const moveText = ChessRules.moveToText(move, state.board);
        const colorClass = ChessRules.isRed(move.piece) ? 'red' : 'black';
        const num = Math.ceil(state.moveHistory.length / 2);
        
        const item = document.createElement('span');
        item.className = `move-item ${colorClass}`;
        item.textContent = `${num}.${moveText}`;
        historyList.appendChild(item);
        historyList.scrollLeft = historyList.scrollWidth;
    }

    function updateMoveHistory() {
        const historyList = $('#history-list');
        historyList.innerHTML = state.moveHistory.map((move, i) => {
            const text = ChessRules.moveToText(move, state.board);
            const colorClass = ChessRules.isRed(move.piece) ? 'red' : 'black';
            return `<span class="move-item ${colorClass}">${Math.floor(i/2) + 1}.${text}</span>`;
        }).join('');
    }

    // ===== 检查游戏结束 =====
    function checkGameEnd() {
        if (ChessRules.isCheckmate(state.board, state.isRedTurn)) {
            state.isGameOver = true;
            const winner = state.isRedTurn ? '黑方' : '红方';
            
            setTimeout(async () => {
                const msg = `${winner}获胜！`;
                updateAdvice(msg);
                setStatus('游戏结束');
                
                if (state.voiceEnabled) {
                    await VoiceModule.speak(msg);
                }
                
                showGameOver(msg);
            }, 500);
            
            return true;
        }
        
        // 检查是否被将军
        if (ChessRules.isInCheck(state.board, state.isRedTurn)) {
            const side = state.isRedTurn ? '红方' : '黑方';
            toast(`${side}被将军！`);
            if (state.voiceEnabled) {
                VoiceModule.speakHint('将军！');
            }
        }
        
        return false;
    }

    // ===== 显示游戏结束 =====
    function showGameOver(message) {
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        overlay.innerHTML = `
            <div class="game-over-content">
                <div class="result-icon">🏆</div>
                <h2>${message}</h2>
                <p>精彩对局！</p>
                <div class="game-over-actions">
                    <button class="btn-secondary" id="go-back">返回</button>
                    <button class="btn-primary" id="play-again">再来一局</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#go-back').onclick = () => {
            overlay.remove();
            CameraModule.stopCamera();
            showScreen('setup');
        };
        overlay.querySelector('#play-again').onclick = () => {
            overlay.remove();
            startGame();
        };
    }

    // ===== 工具函数 =====
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function toast(message, duration = 2000) {
        const toastEl = $('#toast');
        toastEl.textContent = message;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), duration);
    }

    // ===== 启动应用 =====
    document.addEventListener('DOMContentLoaded', init);
})();
