import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { dictationWords, type DictationWord } from '../data/dictationWords';
import { questionBank } from '../data/loadQuestionBank';
import {
  fetchUsPhonetic,
  playLocalUsSlowWordAudio,
  playUsWordAudio,
  stopUsWordAudioPlayback,
} from '../lib/phonetic';
import {
  assessSpokenText,
  getSpeechRecognitionErrorMessage,
  isSpeechRecognitionSupported,
  recognizeSpeechOnce,
} from '../lib/speechAssessment';
import { loadState, saveState } from '../lib/storage';
import { findQuestionIdByPrompt, playWrongAnswerTone, updateWrongBookForQuestion } from '../lib/studyFeedback';
import { fetchWordImage } from '../lib/wordImage';

type DictationStep =
  | {
      id: string;
      type: 'study';
      word: DictationWord;
    }
  | {
      id: string;
      type: 'listenChoose';
      word: DictationWord;
      options: string[];
    }
  | {
      id: string;
      type: 'listenSpell';
      word: DictationWord;
      mask: string;
    };

interface DictationAnswer {
  stepId: string;
  type: 'listenChoose' | 'listenSpell';
  word: string;
  meaning: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildMask(word: string): string {
  return word
    .split('')
    .map(() => '_')
    .join(' ');
}

function buildSteps(words: DictationWord[]): DictationStep[] {
  const meanings = words.map((item) => item.meaning);

  const studySteps: DictationStep[] = words.map((word) => ({
    id: `study-${word.id}`,
    type: 'study',
    word,
  }));

  const listenChooseSteps: DictationStep[] = shuffleArray(words).map((word) => {
    const wrongMeanings = shuffleArray(meanings.filter((item) => item !== word.meaning)).slice(0, 3);
    return {
      id: `listen-choose-${word.id}`,
      type: 'listenChoose',
      word,
      options: shuffleArray([word.meaning, ...wrongMeanings]),
    };
  });

  const listenSpellSteps: DictationStep[] = shuffleArray(words).map((word) => ({
    id: `listen-spell-${word.id}`,
    type: 'listenSpell',
    word,
    mask: buildMask(word.word),
  }));

  return [...studySteps, ...listenChooseSteps, ...listenSpellSteps];
}

function getStageLabel(step: DictationStep): string {
  if (step.type === 'study') return '第 1 轮 · 认识单词';
  if (step.type === 'listenChoose') return '第 2 轮 · 听音辨义';
  return '第 3 轮 · 听音拼写';
}

function getCardTitle(step: DictationStep): string {
  if (step.type === 'study') return step.word.word;
  if (step.type === 'listenChoose') return '听一听，选出正确中文意思';
  return '听一听，把单词完整拼出来';
}

function getCardSubtitle(step: DictationStep): string {
  if (step.type === 'study') return `中文释义：${step.word.meaning}`;
  if (step.type === 'listenChoose') return '先播放读音，再选意思。';
  return '先播放读音，再输入拼写。';
}

export function DictationPage() {
  const [steps, setSteps] = useState<DictationStep[]>(() => buildSteps(dictationWords));
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [wordImageUrl, setWordImageUrl] = useState('');
  const [wordImageLoading, setWordImageLoading] = useState(false);
  const [answers, setAnswers] = useState<DictationAnswer[]>([]);
  const [speechChecking, setSpeechChecking] = useState(false);
  const [speechCheckMessage, setSpeechCheckMessage] = useState('');
  const [speechCheckPassed, setSpeechCheckPassed] = useState<boolean | null>(null);
  const autoPlayStepRef = useRef('');

  const currentStep = stepIndex < steps.length ? steps[stepIndex] : null;
  const speechRecognitionSupported = isSpeechRecognitionSupported();
  const quizTotal = steps.filter((step) => step.type !== 'study').length;
  const isCompleted = currentStep === null;

  const stopAudioPlayback = useCallback(() => {
    stopUsWordAudioPlayback();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const playCurrentWord = useCallback(async () => {
    if (!currentStep) return;

    stopAudioPlayback();
    const playedWithDictionaryAudio = await playUsWordAudio(currentStep.word.word, 1);
    if (playedWithDictionaryAudio) {
      setFeedback('');
      return;
    }

    setFeedback('当前单词词典发音加载失败，请稍后重试。');
  }, [currentStep, stopAudioPlayback]);

  const playSlowWord = useCallback(async () => {
    if (!currentStep) return;

    stopAudioPlayback();
    const playedWithLocalSlowAudio = await playLocalUsSlowWordAudio(currentStep.word.word);
    if (!playedWithLocalSlowAudio) {
      setFeedback('当前单词暂无本地慢速语音。');
      return;
    }

    setFeedback('');
  }, [currentStep, stopAudioPlayback]);

  const runSpeechCheck = useCallback(async () => {
    if (!currentStep) return;

    if (!speechRecognitionSupported) {
      setSpeechCheckPassed(false);
      setSpeechCheckMessage('当前浏览器不支持语音识别。iPad 请使用 Safari，并确认已开启 Siri。');
      return;
    }

    stopAudioPlayback();
    setSpeechChecking(true);
    setSpeechCheckPassed(null);
    setSpeechCheckMessage('正在听你读，请开始说英文...');

    const attempt = await recognizeSpeechOnce('en-US', 8000);
    if (!attempt.ok) {
      setSpeechChecking(false);
      setSpeechCheckPassed(false);
      setSpeechCheckMessage(getSpeechRecognitionErrorMessage(attempt.error));
      return;
    }

    const assessment = assessSpokenText(currentStep.word.word, attempt.transcript);
    setSpeechChecking(false);
    setSpeechCheckPassed(assessment.passed);
    setSpeechCheckMessage(
      `识别到：${attempt.transcript}。匹配度 ${assessment.score}% · ${assessment.passed ? '判定通过' : '再读一次会更好。'}`,
    );
  }, [currentStep, speechRecognitionSupported, stopAudioPlayback]);

  const recordWrongWord = useCallback((word: string) => {
    const questionId = findQuestionIdByPrompt(questionBank, word);
    if (questionId === null) return;

    const now = new Date();
    const state = loadState();
    const feedbackState = updateWrongBookForQuestion(state.wrongBook, state.reviewTasks, questionId, now);
    state.wrongBook = feedbackState.wrongBook;
    state.reviewTasks = feedbackState.reviewTasks;
    saveState(state);
  }, []);

  useEffect(() => {
    if (!currentStep) return;

    let canceled = false;
    fetchUsPhonetic(currentStep.word.word).then((nextPhonetic) => {
      if (canceled) return;
      setPhonetic(nextPhonetic ?? '');
    });

    return () => {
      canceled = true;
    };
  }, [currentStep]);

  useEffect(() => {
    if (!currentStep || currentStep.type !== 'study') return;

    let canceled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWordImageLoading(true);
    fetchWordImage(currentStep.word.word, currentStep.word.imageHint).then((result) => {
      if (canceled) return;
      setWordImageUrl(result ?? '');
      setWordImageLoading(false);
    });

    return () => {
      canceled = true;
    };
  }, [currentStep]);

  useEffect(() => {
    if (!currentStep) return;

    const autoPlayKey = currentStep.id;
    if (autoPlayStepRef.current === autoPlayKey) return;
    autoPlayStepRef.current = autoPlayKey;

    const timer = window.setTimeout(() => {
      void playCurrentWord();
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStep, playCurrentWord]);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const resetStepUi = () => {
    stopAudioPlayback();
    setSelectedMeaning(null);
    setSpellingInput('');
    setFeedback('');
    setPhonetic('');
    setWordImageUrl('');
    setWordImageLoading(false);
    setSpeechChecking(false);
    setSpeechCheckMessage('');
    setSpeechCheckPassed(null);
  };

  const moveNext = () => {
    resetStepUi();
    setStepIndex((value) => value + 1);
  };

  const restartSession = () => {
    autoPlayStepRef.current = '';
    resetStepUi();
    setAnswers([]);
    setStepIndex(0);
    setSteps(buildSteps(dictationWords));
  };

  const submitStep = () => {
    if (!currentStep) return;

    if (currentStep.type === 'study') {
      moveNext();
      return;
    }

    if (feedback) {
      moveNext();
      return;
    }

    if (currentStep.type === 'listenChoose') {
      if (!selectedMeaning) return;

      const isCorrect = selectedMeaning === currentStep.word.meaning;
      setAnswers((previous) => [
        ...previous,
        {
          stepId: currentStep.id,
          type: currentStep.type,
          word: currentStep.word.word,
          meaning: currentStep.word.meaning,
          userAnswer: selectedMeaning,
          correctAnswer: currentStep.word.meaning,
          isCorrect,
        },
      ]);
      if (!isCorrect) {
        recordWrongWord(currentStep.word.word);
        playWrongAnswerTone();
      }
      setFeedback(isCorrect ? '答对了，继续下一题。' : `答错了，正确意思是“${currentStep.word.meaning}”。`);
      return;
    }

    if (spellingInput.trim().length === 0) return;

    const normalizedInput = spellingInput.trim().toLowerCase();
    const normalizedAnswer = currentStep.word.word.toLowerCase();
    const isCorrect = normalizedInput === normalizedAnswer;

    setAnswers((previous) => [
      ...previous,
      {
        stepId: currentStep.id,
        type: currentStep.type,
        word: currentStep.word.word,
        meaning: currentStep.word.meaning,
        userAnswer: spellingInput.trim(),
        correctAnswer: currentStep.word.word,
        isCorrect,
      },
    ]);
    if (!isCorrect) {
      recordWrongWord(currentStep.word.word);
      playWrongAnswerTone();
    }
    setFeedback(isCorrect ? '拼写正确，继续下一题。' : `这题先记住，正确拼写是 ${currentStep.word.word}。`);
  };

  if (isCompleted) {
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const percent = Math.round((correctCount / Math.max(quizTotal, 1)) * 100);
    const wrongAnswers = answers.filter((answer) => !answer.isCorrect);
    const wrongWordSummary = Array.from(
      wrongAnswers.reduce<Map<string, { word: string; meaning: string; wrongCount: number }>>((acc, answer) => {
        const existing = acc.get(answer.word);
        if (existing) {
          existing.wrongCount += 1;
          return acc;
        }

        acc.set(answer.word, {
          word: answer.word,
          meaning: answer.meaning,
          wrongCount: 1,
        });
        return acc;
      }, new Map()).values(),
    );

    return (
      <main className="page">
        <h1>听写单词学习</h1>
        <Card title="本轮完成" subtitle={`已经完成这 ${dictationWords.length} 个单词的认识、辨义和听写。`}>
          <p>学习单词：{dictationWords.length} 个</p>
          <p>测验题数：{quizTotal} 题</p>
          <p>答对：{correctCount} 题</p>
          <p>正确率：{percent}%</p>
        </Card>

        {wrongAnswers.length > 0 ? (
          <Card title="这几题还要再看一遍" subtitle="先听，再看意思，再重新拼写。">
            <div className="dictation-summary">
              {wrongWordSummary.map((answer) => (
                <div key={answer.word} className="dictation-summary-item">
                  <strong>{answer.word}</strong>
                  <span>中文：{answer.meaning}</span>
                  <span>本轮错了：{answer.wrongCount} 次</span>
                  <span>已加入错题本，建议优先复习。</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card title="表现很好" subtitle="这一轮没有做错，可以稍后再练一遍巩固记忆。">
            <p>这 {dictationWords.length} 个词已经基本掌握了。</p>
          </Card>
        )}

        <Card title="继续练习">
          <div className="actions-stack">
            <Button fullWidth onClick={restartSession}>
              再来一轮听写
            </Button>
            <Link className="link-reset" to="/">
              <Button variant="secondary" fullWidth>
                返回首页
              </Button>
            </Link>
            <Link className="link-reset" to="/wrong">
              <Button variant="ghost" fullWidth>
                打开错题本
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const isStudyStep = currentStep.type === 'study';
  const isChooseStep = currentStep.type === 'listenChoose';
  const isSpellStep = currentStep.type === 'listenSpell';
  const speechCheckClassName = speechCheckPassed === null
    ? 'speech-check'
    : speechCheckPassed
      ? 'speech-check speech-check-pass'
      : 'speech-check speech-check-warn';
  const getChoiceOptionClassName = (option: string) => {
    const classes = ['option'];

    if (selectedMeaning === option) {
      classes.push('option-selected');
    }

    if (currentStep.type === 'listenChoose' && feedback) {
      if (option === currentStep.word.meaning) {
        classes.push('option-correct');
      } else if (selectedMeaning === option) {
        classes.push('option-wrong');
      }
    }

    return classes.join(' ');
  };

  return (
    <main className="page">
      <h1>听写单词学习</h1>
      <ProgressBar current={stepIndex + 1} total={steps.length} />

      <Card title={getCardTitle(currentStep)} subtitle={getCardSubtitle(currentStep)}>
        <p className="dictation-stage">{getStageLabel(currentStep)}</p>

        <div className="dictation-audio-row">
          <Button variant="ghost" onClick={() => void playCurrentWord()}>
            播放发音
          </Button>
          <Button variant="ghost" onClick={() => void playSlowWord()}>
            慢速播放
          </Button>
          <Button variant="ghost" onClick={() => void runSpeechCheck()} disabled={speechChecking || !speechRecognitionSupported}>
            {speechChecking ? '识别中...' : '跟读判定'}
          </Button>
        </div>
        {speechCheckMessage ? <p className={speechCheckClassName}>{speechCheckMessage}</p> : null}
        {!speechRecognitionSupported ? (
          <p className="speech-check speech-check-warn">当前浏览器不支持语音识别。iPad 请使用 Safari，并确认已开启 Siri。</p>
        ) : null}

        {isStudyStep ? (
          <div className="learning-block">
            {wordImageUrl ? (
              <img
                className="spelling-image"
                src={wordImageUrl}
                alt="单词学习图片"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <p className="muted">{wordImageLoading ? '图片加载中...' : '暂时没有图片，先听读音记忆。'}</p>
            )}

            <div className="dictation-info-grid">
              <p>
                <strong>英文单词：</strong>
                {currentStep.word.word}
              </p>
              <p>
                <strong>中文意思：</strong>
                {currentStep.word.meaning}
              </p>
              {phonetic ? (
                <p>
                  <strong>美式音标：</strong>
                  {phonetic}
                </p>
              ) : null}
              <p>
                <strong>记忆提示：</strong>
                {currentStep.word.note}
              </p>
            </div>
          </div>
        ) : null}

        {isChooseStep ? (
          <div className="options">
            {currentStep.options.map((option) => (
              <button
                key={`${currentStep.id}-${option}`}
                className={getChoiceOptionClassName(option)}
                onClick={() => {
                  if (feedback) return;
                  setSelectedMeaning(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {isSpellStep ? (
          <div className="learning-block">
            <p className="dictation-mask">字母格数提示：{currentStep.mask}</p>
            <label className="spelling-label" htmlFor="dictation-spell-input">
              听发音后输入完整单词：
            </label>
            <input
              id="dictation-spell-input"
              className="spelling-input"
              value={spellingInput}
              onChange={(event) => setSpellingInput(event.target.value)}
              placeholder="请输入单词"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={Boolean(feedback)}
            />
          </div>
        ) : null}

        {feedback ? <p className="feedback">{feedback}</p> : null}

        <Button
          fullWidth
          onClick={submitStep}
          disabled={
            (isChooseStep && !selectedMeaning && !feedback) ||
            (isSpellStep && spellingInput.trim().length === 0 && !feedback)
          }
        >
          {isStudyStep ? '我记住了，下一张' : feedback ? '下一题' : '提交'}
        </Button>
      </Card>
    </main>
  );
}

