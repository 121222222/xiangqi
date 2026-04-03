/**
 * 语音播报模块
 * 使用 Web Speech API
 */

const VoiceModule = (function() {
    let enabled = true;
    let speaking = false;
    let synthesis = window.speechSynthesis;
    let currentUtterance = null;
    let voiceReady = false;
    let chineseVoice = null;

    // 初始化
    function init() {
        if (!synthesis) {
            console.warn('浏览器不支持语音合成');
            return false;
        }

        // 获取中文语音
        const loadVoices = () => {
            const voices = synthesis.getVoices();
            // 优先找中文语音
            chineseVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN')) 
                        || voices.find(v => v.lang.includes('cmn'))
                        || voices[0];
            voiceReady = true;
            console.log('语音已就绪:', chineseVoice?.name);
        };

        // 某些浏览器需要异步加载语音
        if (synthesis.getVoices().length > 0) {
            loadVoices();
        } else {
            synthesis.onvoiceschanged = loadVoices;
        }

        return true;
    }

    // 播报文字
    function speak(text, options = {}) {
        if (!enabled || !synthesis) return Promise.resolve();

        // 停止当前播报
        stop();

        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 设置语音参数
            utterance.voice = chineseVoice;
            utterance.lang = 'zh-CN';
            utterance.rate = options.rate || 1.0;  // 语速
            utterance.pitch = options.pitch || 1.0; // 音调
            utterance.volume = options.volume || 1.0; // 音量

            utterance.onstart = () => {
                speaking = true;
                if (options.onStart) options.onStart();
            };

            utterance.onend = () => {
                speaking = false;
                currentUtterance = null;
                if (options.onEnd) options.onEnd();
                resolve();
            };

            utterance.onerror = (e) => {
                speaking = false;
                currentUtterance = null;
                console.error('语音播报错误:', e);
                resolve();
            };

            currentUtterance = utterance;
            synthesis.speak(utterance);
        });
    }

    // 停止播报
    function stop() {
        if (synthesis) {
            synthesis.cancel();
        }
        speaking = false;
        currentUtterance = null;
    }

    // 播报象棋走法
    function speakMove(moveText, isAI = false) {
        const prefix = isAI ? 'AI建议：' : '';
        return speak(prefix + moveText);
    }

    // 播报AI建议
    function speakAdvice(advice) {
        return speak(advice, { rate: 0.95 });
    }

    // 播报提示
    function speakHint(hint) {
        return speak(hint, { rate: 1.1 });
    }

    // 开启/关闭
    function setEnabled(value) {
        enabled = value;
        if (!value) {
            stop();
        }
    }

    function isEnabled() {
        return enabled;
    }

    function isSpeaking() {
        return speaking;
    }

    // 测试语音
    function test() {
        speak('语音测试成功');
    }

    return {
        init,
        speak,
        stop,
        speakMove,
        speakAdvice,
        speakHint,
        setEnabled,
        isEnabled,
        isSpeaking,
        test
    };
})();
