/**
 * 象棋AI引擎
 * 使用Alpha-Beta剪枝搜索
 */

const ChessAI = (function() {
    const { PIECES, PIECE_VALUES, isRed, isBlack, generateMoves, makeMove, isInCheck, isCheckmate } = ChessRules;

    // 位置价值表（激励棋子走到更好的位置）
    const POSITION_VALUES = {
        // 马的位置价值
        KNIGHT: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 2, 4, 4, 4, 2, 0, 0],
            [0, 2, 4, 6, 8, 6, 4, 2, 0],
            [0, 2, 4, 6, 8, 6, 4, 2, 0],
            [0, 0, 2, 4, 4, 4, 2, 0, 0],
            [0, 0, 0, 2, 2, 2, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        // 炮的位置价值
        CANNON: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 2, 3, 4, 3, 2, 0, 0],
            [0, 2, 4, 5, 6, 5, 4, 2, 0],
            [0, 2, 4, 5, 6, 5, 4, 2, 0],
            [0, 0, 2, 3, 4, 3, 2, 0, 0],
            [2, 3, 4, 4, 4, 4, 4, 3, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        // 兵/卒的位置价值（过河后加分）
        PAWN: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [20, 30, 40, 50, 50, 50, 40, 30, 20],
            [10, 20, 30, 40, 40, 40, 30, 20, 10],
            [5, 10, 18, 30, 35, 30, 18, 10, 5],
            [2, 5, 10, 15, 20, 15, 10, 5, 2],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]
    };

    // 搜索深度（根据难度调整）
    let searchDepth = 3;

    // 设置难度
    function setDifficulty(level) {
        searchDepth = level + 1; // 1=2层, 2=3层, 3=4层
    }

    // 评估函数
    function evaluate(board, isRedAI) {
        let score = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece === 0) continue;

                const pieceValue = PIECE_VALUES[piece];
                let positionValue = 0;

                // 获取位置加成
                const pieceType = isRed(piece) ? piece : piece - 7;
                if (pieceType === 4) { // 马
                    positionValue = isRed(piece) ? 
                        POSITION_VALUES.KNIGHT[9 - r][c] : 
                        POSITION_VALUES.KNIGHT[r][c];
                } else if (pieceType === 6) { // 炮
                    positionValue = isRed(piece) ? 
                        POSITION_VALUES.CANNON[9 - r][c] : 
                        POSITION_VALUES.CANNON[r][c];
                } else if (pieceType === 7) { // 兵
                    positionValue = isRed(piece) ? 
                        POSITION_VALUES.PAWN[9 - r][c] : 
                        POSITION_VALUES.PAWN[r][c];
                }

                const total = pieceValue + positionValue;
                
                // AI执红则红方加分，AI执黑则黑方加分
                if (isRedAI) {
                    score += isRed(piece) ? total : -total;
                } else {
                    score += isBlack(piece) ? total : -total;
                }
            }
        }

        return score;
    }

    // Alpha-Beta搜索
    function alphaBeta(board, depth, alpha, beta, isMaximizing, isRedTurn, isRedAI) {
        // 达到搜索深度或游戏结束
        if (depth === 0) {
            return { score: evaluate(board, isRedAI), move: null };
        }

        const moves = generateMoves(board, isRedTurn);
        
        if (moves.length === 0) {
            // 无子可走
            if (isInCheck(board, isRedTurn)) {
                // 被将死
                return { score: isMaximizing ? -99999 + depth : 99999 - depth, move: null };
            }
            // 和棋
            return { score: 0, move: null };
        }

        // 走法排序（优化搜索效率）
        moves.sort((a, b) => {
            const aValue = a.captured ? PIECE_VALUES[a.captured] : 0;
            const bValue = b.captured ? PIECE_VALUES[b.captured] : 0;
            return bValue - aValue;
        });

        let bestMove = moves[0];

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of moves) {
                const newBoard = makeMove(board, move);
                const result = alphaBeta(newBoard, depth - 1, alpha, beta, false, !isRedTurn, isRedAI);
                if (result.score > maxScore) {
                    maxScore = result.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, result.score);
                if (beta <= alpha) break; // 剪枝
            }
            return { score: maxScore, move: bestMove };
        } else {
            let minScore = Infinity;
            for (const move of moves) {
                const newBoard = makeMove(board, move);
                const result = alphaBeta(newBoard, depth - 1, alpha, beta, true, !isRedTurn, isRedAI);
                if (result.score < minScore) {
                    minScore = result.score;
                    bestMove = move;
                }
                beta = Math.min(beta, result.score);
                if (beta <= alpha) break; // 剪枝
            }
            return { score: minScore, move: bestMove };
        }
    }

    // 获取AI最佳走法
    function getBestMove(board, isRedAI) {
        const result = alphaBeta(board, searchDepth, -Infinity, Infinity, true, isRedAI, isRedAI);
        return result.move;
    }

    // 异步获取走法（避免阻塞UI）
    function getBestMoveAsync(board, isRedAI) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const move = getBestMove(board, isRedAI);
                resolve(move);
            }, 100);
        });
    }

    // 获取提示走法
    function getHint(board, isRedTurn) {
        // 用较低深度快速计算
        const oldDepth = searchDepth;
        searchDepth = 2;
        const move = getBestMove(board, isRedTurn);
        searchDepth = oldDepth;
        return move;
    }

    return {
        setDifficulty,
        getBestMove,
        getBestMoveAsync,
        getHint,
        evaluate
    };
})();
