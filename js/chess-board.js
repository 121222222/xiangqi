/**
 * 棋盘渲染模块
 * 负责棋盘和棋子的绘制、交互
 */

const ChessBoard = (function() {
    const { PIECES, PIECE_NAMES, isRed, isBlack, isSameColor } = ChessRules;

    let canvas, ctx;
    let boardSize = 0;
    let cellSize = 0;
    let pieceRadius = 0;
    let offsetX = 0, offsetY = 0;
    let flipped = false; // 棋盘是否翻转

    // 颜色配置
    const COLORS = {
        board: '#f5d89a',
        boardDark: '#e8c86b',
        line: '#5a3d2b',
        redPiece: '#c0392b',
        redPieceBg: '#fff5f5',
        blackPiece: '#1a1a1a',
        blackPieceBg: '#f8f8f8',
        selected: 'rgba(39, 174, 96, 0.4)',
        lastMove: 'rgba(243, 156, 18, 0.3)',
        validMove: 'rgba(39, 174, 96, 0.6)',
        check: 'rgba(231, 76, 60, 0.4)'
    };

    // 初始化画布
    function init(canvasElement) {
        canvas = canvasElement;
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    // 调整尺寸
    function resize() {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth - 16;
        const containerHeight = container.clientHeight - 16;
        
        // 棋盘比例约为 9:10
        const aspectRatio = 9 / 10;
        
        let width, height;
        if (containerWidth / containerHeight > aspectRatio) {
            height = containerHeight;
            width = height * aspectRatio;
        } else {
            width = containerWidth;
            height = width / aspectRatio;
        }

        // 设备像素比（高清屏）
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        boardSize = width;
        cellSize = width / 10;
        pieceRadius = cellSize * 0.42;
        offsetX = cellSize * 0.5;
        offsetY = cellSize * 0.5;

        return { width, height };
    }

    // 绘制棋盘
    function drawBoard() {
        const w = boardSize;
        const h = boardSize / 9 * 10;
        
        // 背景
        ctx.fillStyle = COLORS.board;
        ctx.fillRect(0, 0, w, h);

        // 棋盘格
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1.5;

        // 横线
        for (let i = 0; i < 10; i++) {
            const y = offsetY + i * cellSize;
            ctx.beginPath();
            ctx.moveTo(offsetX, y);
            ctx.lineTo(offsetX + 8 * cellSize, y);
            ctx.stroke();
        }

        // 竖线
        for (let i = 0; i < 9; i++) {
            const x = offsetX + i * cellSize;
            if (i === 0 || i === 8) {
                // 边线贯穿
                ctx.beginPath();
                ctx.moveTo(x, offsetY);
                ctx.lineTo(x, offsetY + 9 * cellSize);
                ctx.stroke();
            } else {
                // 中间线在河界断开
                ctx.beginPath();
                ctx.moveTo(x, offsetY);
                ctx.lineTo(x, offsetY + 4 * cellSize);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, offsetY + 5 * cellSize);
                ctx.lineTo(x, offsetY + 9 * cellSize);
                ctx.stroke();
            }
        }

        // 九宫斜线
        const drawPalaceDiagonals = (startRow) => {
            const y1 = offsetY + startRow * cellSize;
            const y2 = offsetY + (startRow + 2) * cellSize;
            const x1 = offsetX + 3 * cellSize;
            const x2 = offsetX + 5 * cellSize;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x2, y1);
            ctx.lineTo(x1, y2);
            ctx.stroke();
        };
        drawPalaceDiagonals(0);
        drawPalaceDiagonals(7);

        // 炮和兵的标记点
        const drawMark = (row, col) => {
            const x = offsetX + col * cellSize;
            const y = offsetY + row * cellSize;
            const d = cellSize * 0.1;
            const gap = cellSize * 0.08;
            const len = cellSize * 0.15;

            const drawCorner = (dx, dy) => {
                if (col + dx >= 0 && col + dx <= 8) {
                    ctx.beginPath();
                    ctx.moveTo(x + dx * gap, y + dy * (gap + len));
                    ctx.lineTo(x + dx * gap, y + dy * gap);
                    ctx.lineTo(x + dx * (gap + len), y + dy * gap);
                    ctx.stroke();
                }
            };

            if (col > 0) {
                drawCorner(-1, -1);
                drawCorner(-1, 1);
            }
            if (col < 8) {
                drawCorner(1, -1);
                drawCorner(1, 1);
            }
        };

        // 炮位
        drawMark(2, 1); drawMark(2, 7);
        drawMark(7, 1); drawMark(7, 7);
        // 兵/卒位
        for (let i = 0; i < 5; i++) {
            drawMark(3, i * 2);
            drawMark(6, i * 2);
        }

        // 楚河汉界
        ctx.font = `bold ${cellSize * 0.4}px serif`;
        ctx.fillStyle = COLORS.line;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const riverY = offsetY + 4.5 * cellSize;
        if (flipped) {
            ctx.fillText('汉  界', offsetX + 2 * cellSize, riverY);
            ctx.fillText('楚  河', offsetX + 6 * cellSize, riverY);
        } else {
            ctx.fillText('楚  河', offsetX + 2 * cellSize, riverY);
            ctx.fillText('汉  界', offsetX + 6 * cellSize, riverY);
        }
    }

    // 绘制棋子
    function drawPiece(row, col, piece, options = {}) {
        if (piece === 0) return;

        const { selected, lastMove, validTarget, inCheck } = options;
        
        // 转换坐标（考虑翻转）
        const displayRow = flipped ? 9 - row : row;
        const displayCol = flipped ? 8 - col : col;
        
        const x = offsetX + displayCol * cellSize;
        const y = offsetY + displayRow * cellSize;

        // 高亮背景
        if (selected) {
            ctx.fillStyle = COLORS.selected;
            ctx.beginPath();
            ctx.arc(x, y, pieceRadius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (lastMove) {
            ctx.fillStyle = COLORS.lastMove;
            ctx.beginPath();
            ctx.arc(x, y, pieceRadius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (inCheck) {
            ctx.fillStyle = COLORS.check;
            ctx.beginPath();
            ctx.arc(x, y, pieceRadius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 棋子底色
        const isRedPiece = isRed(piece);
        ctx.beginPath();
        ctx.arc(x, y, pieceRadius, 0, Math.PI * 2);
        ctx.fillStyle = isRedPiece ? COLORS.redPieceBg : COLORS.blackPieceBg;
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = isRedPiece ? COLORS.redPiece : COLORS.blackPiece;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 内圈
        ctx.beginPath();
        ctx.arc(x, y, pieceRadius * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // 棋子文字
        ctx.fillStyle = isRedPiece ? COLORS.redPiece : COLORS.blackPiece;
        ctx.font = `bold ${pieceRadius * 1.1}px "楷体", "STKaiti", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(PIECE_NAMES[piece], x, y + 1);
    }

    // 绘制可走位置标记
    function drawValidMoves(validMoves) {
        for (const move of validMoves) {
            const [row, col] = move.to;
            const displayRow = flipped ? 9 - row : row;
            const displayCol = flipped ? 8 - col : col;
            
            const x = offsetX + displayCol * cellSize;
            const y = offsetY + displayRow * cellSize;

            ctx.fillStyle = COLORS.validMove;
            if (move.captured) {
                // 吃子位置画圆环
                ctx.beginPath();
                ctx.arc(x, y, pieceRadius * 0.9, 0, Math.PI * 2);
                ctx.lineWidth = 3;
                ctx.strokeStyle = COLORS.validMove;
                ctx.stroke();
            } else {
                // 空位画小圆点
                ctx.beginPath();
                ctx.arc(x, y, cellSize * 0.12, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 完整渲染
    function render(board, options = {}) {
        const { selectedPos, lastMove, validMoves, checkPos } = options;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 画棋盘
        drawBoard();
        
        // 画棋子
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                const pieceOptions = {
                    selected: selectedPos && selectedPos[0] === r && selectedPos[1] === c,
                    lastMove: lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) ||
                                           (lastMove.to[0] === r && lastMove.to[1] === c)),
                    inCheck: checkPos && checkPos[0] === r && checkPos[1] === c
                };
                drawPiece(r, c, piece, pieceOptions);
            }
        }

        // 画可走位置
        if (validMoves && validMoves.length > 0) {
            drawValidMoves(validMoves);
        }
    }

    // 坐标转换：像素坐标 -> 棋盘坐标
    function pixelToBoard(px, py) {
        const rect = canvas.getBoundingClientRect();
        const x = px - rect.left;
        const y = py - rect.top;

        let col = Math.round((x - offsetX) / cellSize);
        let row = Math.round((y - offsetY) / cellSize);

        // 翻转处理
        if (flipped) {
            row = 9 - row;
            col = 8 - col;
        }

        if (row >= 0 && row <= 9 && col >= 0 && col <= 8) {
            return [row, col];
        }
        return null;
    }

    // 设置翻转状态
    function setFlipped(value) {
        flipped = value;
    }

    function isFlipped() {
        return flipped;
    }

    function getCanvas() {
        return canvas;
    }

    return {
        init,
        resize,
        render,
        pixelToBoard,
        setFlipped,
        isFlipped,
        getCanvas
    };
})();
