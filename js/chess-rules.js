/**
 * 象棋规则引擎
 * 包含棋盘表示、走法生成、合法性检查
 */

const ChessRules = (function() {
    // 棋子定义
    const PIECES = {
        EMPTY: 0,
        R_KING: 1,    // 红帅
        R_ADVISOR: 2, // 红仕
        R_BISHOP: 3,  // 红相
        R_KNIGHT: 4,  // 红马
        R_ROOK: 5,    // 红车
        R_CANNON: 6,  // 红炮
        R_PAWN: 7,    // 红兵
        B_KING: 8,    // 黑将
        B_ADVISOR: 9, // 黑士
        B_BISHOP: 10, // 黑象
        B_KNIGHT: 11, // 黑马
        B_ROOK: 12,   // 黑车
        B_CANNON: 13, // 黑炮
        B_PAWN: 14    // 黑卒
    };

    // 棋子名称
    const PIECE_NAMES = {
        [PIECES.R_KING]: '帅', [PIECES.R_ADVISOR]: '仕', [PIECES.R_BISHOP]: '相',
        [PIECES.R_KNIGHT]: '马', [PIECES.R_ROOK]: '车', [PIECES.R_CANNON]: '炮', [PIECES.R_PAWN]: '兵',
        [PIECES.B_KING]: '将', [PIECES.B_ADVISOR]: '士', [PIECES.B_BISHOP]: '象',
        [PIECES.B_KNIGHT]: '马', [PIECES.B_ROOK]: '车', [PIECES.B_CANNON]: '炮', [PIECES.B_PAWN]: '卒'
    };

    // 棋子分值（用于AI评估）
    const PIECE_VALUES = {
        [PIECES.R_KING]: 10000, [PIECES.R_ADVISOR]: 20, [PIECES.R_BISHOP]: 20,
        [PIECES.R_KNIGHT]: 40, [PIECES.R_ROOK]: 90, [PIECES.R_CANNON]: 45, [PIECES.R_PAWN]: 10,
        [PIECES.B_KING]: 10000, [PIECES.B_ADVISOR]: 20, [PIECES.B_BISHOP]: 20,
        [PIECES.B_KNIGHT]: 40, [PIECES.B_ROOK]: 90, [PIECES.B_CANNON]: 45, [PIECES.B_PAWN]: 10
    };

    // 初始棋盘（10行9列，红下黑上）
    const INITIAL_BOARD = [
        [12, 11, 10, 9, 8, 9, 10, 11, 12],  // 黑方底线
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 13, 0, 0, 0, 0, 0, 13, 0],       // 黑炮
        [14, 0, 14, 0, 14, 0, 14, 0, 14],    // 黑卒
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],          // 楚河汉界
        [7, 0, 7, 0, 7, 0, 7, 0, 7],          // 红兵
        [0, 6, 0, 0, 0, 0, 0, 6, 0],          // 红炮
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [5, 4, 3, 2, 1, 2, 3, 4, 5]           // 红方底线
    ];

    // 判断是红方棋子
    function isRed(piece) {
        return piece >= 1 && piece <= 7;
    }

    // 判断是黑方棋子
    function isBlack(piece) {
        return piece >= 8 && piece <= 14;
    }

    // 判断是否同色
    function isSameColor(p1, p2) {
        if (p1 === 0 || p2 === 0) return false;
        return (isRed(p1) && isRed(p2)) || (isBlack(p1) && isBlack(p2));
    }

    // 判断位置是否在棋盘内
    function inBoard(row, col) {
        return row >= 0 && row <= 9 && col >= 0 && col <= 8;
    }

    // 判断是否在九宫内
    function inPalace(row, col, isRedSide) {
        if (col < 3 || col > 5) return false;
        if (isRedSide) return row >= 7 && row <= 9;
        return row >= 0 && row <= 2;
    }

    // 复制棋盘
    function copyBoard(board) {
        return board.map(row => [...row]);
    }

    // 生成所有合法走法
    function generateMoves(board, isRedTurn) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece === 0) continue;
                if ((isRedTurn && isRed(piece)) || (!isRedTurn && isBlack(piece))) {
                    const pieceMoves = generatePieceMoves(board, r, c, piece);
                    moves.push(...pieceMoves);
                }
            }
        }
        // 过滤掉会导致被将军的走法
        return moves.filter(move => {
            const newBoard = makeMove(board, move);
            return !isInCheck(newBoard, isRedTurn);
        });
    }

    // 生成某个棋子的所有走法
    function generatePieceMoves(board, row, col, piece) {
        const moves = [];
        const pieceType = isRed(piece) ? piece : piece - 7;
        const isRedPiece = isRed(piece);

        switch (pieceType) {
            case 1: // 帅/将
                generateKingMoves(board, row, col, isRedPiece, moves);
                break;
            case 2: // 仕/士
                generateAdvisorMoves(board, row, col, isRedPiece, moves);
                break;
            case 3: // 相/象
                generateBishopMoves(board, row, col, isRedPiece, moves);
                break;
            case 4: // 马
                generateKnightMoves(board, row, col, isRedPiece, moves);
                break;
            case 5: // 车
                generateRookMoves(board, row, col, isRedPiece, moves);
                break;
            case 6: // 炮
                generateCannonMoves(board, row, col, isRedPiece, moves);
                break;
            case 7: // 兵/卒
                generatePawnMoves(board, row, col, isRedPiece, moves);
                break;
        }
        return moves;
    }

    // 帅/将走法
    function generateKingMoves(board, row, col, isRed, moves) {
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr, nc = col + dc;
            if (inPalace(nr, nc, isRed) && !isSameColor(board[row][col], board[nr][nc])) {
                moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: board[nr][nc] });
            }
        }
        // 对面将帅（飞将）
        const otherKing = isRed ? PIECES.B_KING : PIECES.R_KING;
        let blocked = false;
        for (let r = isRed ? row - 1 : row + 1; isRed ? r >= 0 : r <= 9; isRed ? r-- : r++) {
            if (board[r][col] !== 0) {
                if (board[r][col] === otherKing && !blocked) {
                    moves.push({ from: [row, col], to: [r, col], piece: board[row][col], captured: board[r][col] });
                }
                blocked = true;
                break;
            }
        }
    }

    // 仕/士走法
    function generateAdvisorMoves(board, row, col, isRed, moves) {
        const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr, nc = col + dc;
            if (inPalace(nr, nc, isRed) && !isSameColor(board[row][col], board[nr][nc])) {
                moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: board[nr][nc] });
            }
        }
    }

    // 相/象走法
    function generateBishopMoves(board, row, col, isRed, moves) {
        const dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
        const blocks = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let i = 0; i < 4; i++) {
            const [dr, dc] = dirs[i];
            const [br, bc] = blocks[i];
            const nr = row + dr, nc = col + dc;
            const blockR = row + br, blockC = col + bc;
            // 不能过河
            const crossRiver = isRed ? nr < 5 : nr > 4;
            if (inBoard(nr, nc) && !crossRiver && 
                board[blockR][blockC] === 0 && 
                !isSameColor(board[row][col], board[nr][nc])) {
                moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: board[nr][nc] });
            }
        }
    }

    // 马走法
    function generateKnightMoves(board, row, col, isRed, moves) {
        const dirs = [
            [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
            [-1, -2, 0, -1], [-1, 2, 0, 1], [1, -2, 0, -1], [1, 2, 0, 1]
        ];
        for (const [dr, dc, br, bc] of dirs) {
            const nr = row + dr, nc = col + dc;
            const blockR = row + br, blockC = col + bc;
            if (inBoard(nr, nc) && board[blockR][blockC] === 0 && 
                !isSameColor(board[row][col], board[nr][nc])) {
                moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: board[nr][nc] });
            }
        }
    }

    // 车走法
    function generateRookMoves(board, row, col, isRed, moves) {
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dr, dc] of dirs) {
            for (let i = 1; i < 10; i++) {
                const nr = row + dr * i, nc = col + dc * i;
                if (!inBoard(nr, nc)) break;
                if (board[nr][nc] === 0) {
                    moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: 0 });
                } else {
                    if (!isSameColor(board[row][col], board[nr][nc])) {
                        moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: board[nr][nc] });
                    }
                    break;
                }
            }
        }
    }

    // 炮走法
    function generateCannonMoves(board, row, col, isRed, moves) {
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dr, dc] of dirs) {
            let jumped = false;
            for (let i = 1; i < 10; i++) {
                const nr = row + dr * i, nc = col + dc * i;
                if (!inBoard(nr, nc)) break;
                if (!jumped) {
                    if (board[nr][nc] === 0) {
                        moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: 0 });
                    } else {
                        jumped = true;
                    }
                } else {
                    if (board[nr][nc] !== 0) {
                        if (!isSameColor(board[row][col], board[nr][nc])) {
                            moves.push({ from: [row, col], to: [nr, nc], piece: board[row][col], captured: board[nr][nc] });
                        }
                        break;
                    }
                }
            }
        }
    }

    // 兵/卒走法
    function generatePawnMoves(board, row, col, isRedPiece, moves) {
        const piece = board[row][col];
        const forward = isRedPiece ? -1 : 1;
        const crossedRiver = isRedPiece ? row <= 4 : row >= 5;

        // 前进
        const nr = row + forward;
        if (inBoard(nr, col) && !isSameColor(piece, board[nr][col])) {
            moves.push({ from: [row, col], to: [nr, col], piece, captured: board[nr][col] });
        }

        // 过河后可以左右走
        if (crossedRiver) {
            for (const dc of [-1, 1]) {
                const nc = col + dc;
                if (inBoard(row, nc) && !isSameColor(piece, board[row][nc])) {
                    moves.push({ from: [row, col], to: [row, nc], piece, captured: board[row][nc] });
                }
            }
        }
    }

    // 执行走法
    function makeMove(board, move) {
        const newBoard = copyBoard(board);
        newBoard[move.to[0]][move.to[1]] = newBoard[move.from[0]][move.from[1]];
        newBoard[move.from[0]][move.from[1]] = 0;
        return newBoard;
    }

    // 检查是否被将军
    function isInCheck(board, isRedKing) {
        // 找到己方将/帅位置
        const kingPiece = isRedKing ? PIECES.R_KING : PIECES.B_KING;
        let kingPos = null;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === kingPiece) {
                    kingPos = [r, c];
                    break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return true; // 将/帅被吃了

        // 检查对方所有棋子是否能吃到将/帅
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece === 0) continue;
                if ((isRedKing && isBlack(piece)) || (!isRedKing && isRed(piece))) {
                    const moves = generatePieceMoves(board, r, c, piece);
                    for (const move of moves) {
                        if (move.to[0] === kingPos[0] && move.to[1] === kingPos[1]) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // 检查是否将死
    function isCheckmate(board, isRedTurn) {
        const moves = generateMoves(board, isRedTurn);
        return moves.length === 0;
    }

    // 检查走法是否合法
    function isValidMove(board, from, to, isRedTurn) {
        const piece = board[from[0]][from[1]];
        if (piece === 0) return false;
        if ((isRedTurn && !isRed(piece)) || (!isRedTurn && !isBlack(piece))) return false;

        const moves = generateMoves(board, isRedTurn);
        return moves.some(m => 
            m.from[0] === from[0] && m.from[1] === from[1] &&
            m.to[0] === to[0] && m.to[1] === to[1]
        );
    }

    // 获取初始棋盘
    function getInitialBoard() {
        return copyBoard(INITIAL_BOARD);
    }

    // 走法转中文描述
    function moveToText(move, board) {
        const piece = move.piece;
        const name = PIECE_NAMES[piece];
        const isRedPiece = isRed(piece);
        
        const cols = isRedPiece ? 
            ['九', '八', '七', '六', '五', '四', '三', '二', '一'] :
            ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        
        const fromCol = cols[move.from[1]];
        const toCol = cols[move.to[1]];
        
        let action;
        const dr = move.to[0] - move.from[0];
        if (dr === 0) {
            action = '平';
        } else if ((isRedPiece && dr < 0) || (!isRedPiece && dr > 0)) {
            action = '进';
        } else {
            action = '退';
        }

        let target;
        if (move.from[1] === move.to[1]) {
            // 直走
            const distance = Math.abs(dr);
            target = isRedPiece ? 
                ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][distance] :
                distance.toString();
        } else {
            target = toCol;
        }

        return `${name}${fromCol}${action}${target}`;
    }

    return {
        PIECES,
        PIECE_NAMES,
        PIECE_VALUES,
        isRed,
        isBlack,
        isSameColor,
        inBoard,
        copyBoard,
        generateMoves,
        makeMove,
        isInCheck,
        isCheckmate,
        isValidMove,
        getInitialBoard,
        moveToText
    };
})();
