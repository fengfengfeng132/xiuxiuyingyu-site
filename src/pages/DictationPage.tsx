import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { dictationWords, type DictationWord } from '../data/dictationWords';
import { questionBank } from '../data/loadQuestionBank';
import {
  fetchUsPhonetic,
  getLocalSlowWordAudioFeedback,
  preloadLocalUsSlowWordAudio,
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
import { createDictationHistoryEntry, summarizeWeeklyDictationHistory } from '../lib/dictationHistory';
import { summarizeWrongDictationAnswers, type DictationAnswerRecord } from '../lib/dictationSummary';
import { buildSpellingFeedback, type SpellingFeedback as SpellingFeedbackData } from '../lib/spellingFeedback';
import { awardPerfectTrainingStar, getStarCount } from '../lib/starRewards';

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

type DictationAnswer = DictationAnswerRecord;

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

export function DictationPage() {
  const [steps, setSteps] = useState<DictationStep[]>(() => buildSteps(dictationWords));
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [spellingFeedbackData, setSpellingFeedbackData] = useState<SpellingFeedbackData | null>(null);
  const [answers, setAnswers] = useState<DictationAnswer[]>([]);
  const [speechChecking, setSpeechChecking] = useState(false);
  const [speechCheckMessage, setSpeechCheckMessage] = useState('');
  const [speechCheckPassed, setSpeechCheckPassed] = useState<boolean | null>(null);
  const [roundHistoryId, setRoundHistoryId] = useState(() => crypto.randomUUID());
  const [roundCompletedAt, setRoundCompletedAt] = useState<string | null>(null);
  const autoPlayStepRef = useRef('');
  const autoPlayTimerRef = useRef<number | null>(null);
  const roundHistorySavedRef = useRef(false);

  const currentStep = stepIndex < steps.length ? steps[stepIndex] : null;
  const speechRecognitionSupported = isSpeechRecognitionSupported();
  const quizTotal = steps.filter((step) => step.type !== 'study').length;
  const isCompleted = currentStep === null;
  const starCount = getStarCount(loadState());

  const stopAudioPlayback = useCallback(() => {
    stopUsWordAudioPlayback();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current === null) return;
    window.clearTimeout(autoPlayTimerRef.current);
    autoPlayTimerRef.current = null;
  }, []);

  const playCurrentWord = useCallback(async () => {
    if (!currentStep) return;

    clearAutoPlayTimer();
    stopAudioPlayback();
    const playback = await playUsWordAudio(currentStep.word.word, 1);
    if (playback.ok || playback.reason === 'stale') {
      setFeedback('');
      return;
    }

    setFeedback('当前单词词典发音加载失败，请稍后重试。');
  }, [clearAutoPlayTimer, currentStep, stopAudioPlayback]);

  const playSlowWord = useCallback(async () => {
    if (!currentStep) return;

    clearAutoPlayTimer();
    stopAudioPlayback();
    const playback = await playLocalUsSlowWordAudio(currentStep.word.word);
    if (!playback.ok) {
      const nextFeedback = getLocalSlowWordAudioFeedback(playback);
      if (nextFeedback) setFeedback(nextFeedback);
      return;
    }

    setFeedback('');
  }, [clearAutoPlayTimer, currentStep, stopAudioPlayback]);

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
    if (!currentStep) return;
    void preloadLocalUsSlowWordAudio(currentStep.word.word);
  }, [currentStep]);

  useEffect(() => {
    if (!currentStep) return;

    const autoPlayKey = currentStep.id;
    if (autoPlayStepRef.current === autoPlayKey) return;
    autoPlayStepRef.current = autoPlayKey;

    clearAutoPlayTimer();
    autoPlayTimerRef.current = window.setTimeout(() => {
      autoPlayTimerRef.current = null;
      void playCurrentWord();
    }, 180);

    return () => {
      clearAutoPlayTimer();
    };
  }, [clearAutoPlayTimer, currentStep, playCurrentWord]);

  useEffect(() => {
    return () => {
      clearAutoPlayTimer();
      stopAudioPlayback();
    };
  }, [clearAutoPlayTimer, stopAudioPlayback]);

  useEffect(() => {
    if (!isCompleted || roundHistorySavedRef.current) return;

    const finishedAt = roundCompletedAt ?? new Date().toISOString();
    roundHistorySavedRef.current = true;

    const state = loadState();
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const rewarded = awardPerfectTrainingStar(state, {
      sourceType: 'dictation',
      sourceId: roundHistoryId,
      title: '每日听写',
      score: correctCount,
      total: quizTotal,
      earnedAt: finishedAt,
    });
    const nextState = rewarded.state;
    const nextHistoryEntry = createDictationHistoryEntry(answers, finishedAt, roundHistoryId);

    if (nextHistoryEntry.wrongWords.length > 0) {
      const existingHistory = nextState.dictationHistory.filter((item) => item.id !== nextHistoryEntry.id);
      nextState.dictationHistory = [nextHistoryEntry, ...existingHistory].slice(0, 90);
    }

    if (rewarded.awarded || nextHistoryEntry.wrongWords.length > 0) {
      saveState(nextState);
    }
  }, [answers, isCompleted, quizTotal, roundCompletedAt, roundHistoryId]);

  const resetStepUi = () => {
    clearAutoPlayTimer();
    stopAudioPlayback();
    setSelectedMeaning(null);
    setSpellingInput('');
    setFeedback('');
    setPhonetic('');
    setSpellingFeedbackData(null);
    setSpeechChecking(false);
    setSpeechCheckMessage('');
    setSpeechCheckPassed(null);
  };

  const moveNext = () => {
    if (stepIndex >= steps.length - 1 && roundCompletedAt === null) {
      setRoundCompletedAt(new Date().toISOString());
    }
    resetStepUi();
    setStepIndex((value) => value + 1);
  };

  const restartSession = () => {
    autoPlayStepRef.current = '';
    setRoundHistoryId(crypto.randomUUID());
    setRoundCompletedAt(null);
    roundHistorySavedRef.current = false;
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

    const trimmedInput = spellingInput.trim();
    const normalizedInput = trimmedInput.toLowerCase();
    const normalizedAnswer = currentStep.word.word.toLowerCase();
    const isCorrect = normalizedInput === normalizedAnswer;
    const nextSpellingFeedback = buildSpellingFeedback(trimmedInput, currentStep.word.word);

    setAnswers((previous) => [
      ...previous,
      {
        stepId: currentStep.id,
        type: currentStep.type,
        word: currentStep.word.word,
        meaning: currentStep.word.meaning,
          userAnswer: trimmedInput,
          correctAnswer: currentStep.word.word,
          isCorrect,
        },
      ]);
    setSpellingFeedbackData(isCorrect ? null : nextSpellingFeedback);
    if (!isCorrect) {
      recordWrongWord(currentStep.word.word);
      playWrongAnswerTone();
    }
    setFeedback(isCorrect ? '拼写正确，继续下一题。' : '拼错了，先看下面红色和绿色提示。');
  };

  const skipStep = () => {
    if (!currentStep) return;

    if (feedback || currentStep.type === 'study') {
      moveNext();
      return;
    }

    const correctAnswer = currentStep.type === 'listenChoose' ? currentStep.word.meaning : currentStep.word.word;
    setAnswers((previous) => [
      ...previous,
      {
        stepId: currentStep.id,
        type: currentStep.type,
        word: currentStep.word.word,
        meaning: currentStep.word.meaning,
        userAnswer: '不会',
        correctAnswer,
        isCorrect: false,
      },
    ]);
    recordWrongWord(currentStep.word.word);
    playWrongAnswerTone();
    moveNext();
  };

  if (isCompleted) {
    const finishedAt = roundCompletedAt ?? new Date().toISOString();
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    const percent = Math.round((correctCount / Math.max(quizTotal, 1)) * 100);
    const wrongAnswers = answers.filter((answer) => !answer.isCorrect);
    const wrongWordSummary = summarizeWrongDictationAnswers(answers);
    const currentRoundHistory = createDictationHistoryEntry(answers, finishedAt, roundHistoryId);
    const savedHistory = loadState().dictationHistory;
    const combinedHistory = savedHistory.some((item) => item.id === currentRoundHistory.id)
      ? savedHistory
      : [currentRoundHistory, ...savedHistory];
    const weeklySummary = summarizeWeeklyDictationHistory(combinedHistory);

    return (
      <main className="page">
        <section className="page-hero page-hero-compact">
          <p className="page-eyebrow">每日听写</p>
          <h1>听写单词学习</h1>
          <p className="page-lead">这一轮已经完成，下面先看本轮结果，再决定要不要马上复练一遍。</p>
          <div className="badge-row">
            <span className="info-pill">本轮 {dictationWords.length} 个词</span>
            <span className="info-pill">测验 {quizTotal} 题</span>
            <span className="info-pill">正确率 {percent}%</span>
          </div>
        </section>

        <Card className="card-tone-blue" title="本轮完成" subtitle={`已经完成这 ${dictationWords.length} 个单词的认识、辨义和听写。`}>
          <div className="stats-grid">
            <div className="stat-card stat-card-white">
              <span className="stat-label">学习单词</span>
              <strong className="stat-value">{dictationWords.length} 个</strong>
            </div>
            <div className="stat-card stat-card-white">
              <span className="stat-label">测验题数</span>
              <strong className="stat-value">{quizTotal} 题</strong>
            </div>
            <div className="stat-card stat-card-white">
              <span className="stat-label">答对</span>
              <strong className="stat-value">{correctCount} 题</strong>
            </div>
            <div className="stat-card stat-card-white">
              <span className="stat-label">正确率</span>
              <strong className="stat-value">{percent}%</strong>
            </div>
          </div>
        </Card>

        {wrongAnswers.length > 0 ? (
          <Card className="card-tone-coral" title="这几题还要再看一遍" subtitle="先听，再看意思，再重新拼写。">
            <div className="dictation-summary">
              {wrongWordSummary.map((answer) => (
                <div key={answer.word} className="dictation-summary-item">
                  <strong>{answer.word}</strong>
                  <span>中文：{answer.meaning}</span>
                  <span>本轮错了：{answer.wrongCount} 次</span>
                  {answer.meaningMistakes.map((mistake, index) => (
                    <div key={`${answer.word}-meaning-${index}`} className="dictation-summary-detail dictation-summary-detail-meaning">
                      <strong>意思错了：</strong>
                      <span>你选了“{mistake.userAnswer}”</span>
                      <span>正确是“{mistake.correctAnswer}”</span>
                    </div>
                  ))}
                  {answer.spellingMistakes.map((mistake, index) => (
                    <div key={`${answer.word}-spelling-${index}`} className="dictation-summary-detail dictation-summary-detail-spelling">
                      <strong>拼写错了：</strong>
                      <span>你写的是“{mistake.userAnswer}”</span>
                      <span>正确单词是“{mistake.correctAnswer}”</span>
                    </div>
                  ))}
                  <span>已加入错题本，建议优先复习。</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="card-tone-mint" title="表现很好" subtitle="这一轮没有做错，可以稍后再练一遍巩固记忆。">
            <p>这 {dictationWords.length} 个词已经基本掌握了。</p>
          </Card>
        )}

        <Card className="card-tone-neutral" title="本周高频错词" subtitle="统计最近 7 天里，哪些词最容易错，主要错在哪一部分。">
          {weeklySummary.length === 0 ? (
            <p>最近 7 天还没有累计到错词统计，继续练习后会显示。</p>
          ) : (
            <div className="dictation-summary">
              {weeklySummary.map((item) => (
                <div key={`weekly-${item.word}`} className="dictation-summary-item">
                  <strong>{item.word}</strong>
                  <span>中文：{item.meaning}</span>
                  <span>本周错了：{item.totalWrongCount} 次</span>
                  <span>意思错了：{item.meaningWrongCount} 次</span>
                  <span>拼写错了：{item.spellingWrongCount} 次</span>
                  <span>
                    主要错在：
                    {item.primaryWeakness === 'meaning'
                      ? '意思'
                      : item.primaryWeakness === 'spelling'
                        ? '拼写'
                        : '意思和拼写'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-tone-yellow" title="继续练习">
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
  const displayProgressCurrent = Math.min(stepIndex + 5, 20);
  const displayProgressTotal = 20;
  const currentProgress = Math.round((displayProgressCurrent / displayProgressTotal) * 100);
  const meaningLine = currentStep.word.word === 'hot' ? 'adj. 热的；烫的' : `释义：${currentStep.word.meaning}`;
  const hintText = currentStep.word.note || `提示：试着用 ${currentStep.word.word} 说一个短句。`;
  const primaryLabel = isStudyStep ? '我记住了' : feedback ? '下一题' : '提交';
  const speechCheckClassName = speechCheckPassed === null
    ? 'speech-check'
    : speechCheckPassed
      ? 'speech-check speech-check-pass'
      : 'speech-check speech-check-warn';
  const getChoiceOptionClassName = (option: string) => {
    const classes = ['lesson-choice-option'];

    if (selectedMeaning === option) {
      classes.push('lesson-choice-option-selected');
    }

    if (currentStep.type === 'listenChoose' && feedback) {
      if (option === currentStep.word.meaning) {
        classes.push('lesson-choice-option-correct');
      } else if (selectedMeaning === option) {
        classes.push('lesson-choice-option-wrong');
      }
    }

    return classes.join(' ');
  };

  return (
    <main className="reference-page dictation-lesson-page">
      <header className="lesson-topbar">
        <Link className="lesson-back-button" to="/" aria-label="返回首页">
          ‹
        </Link>
        <strong>听写单词</strong>
        <Link className="lesson-star-badge" to="/stars" aria-label={`学习星星 ${starCount} 个，查看获得记录`}>
          {starCount}
        </Link>
      </header>

      <section className="lesson-progress-card" aria-label={`学习进度 ${displayProgressCurrent}/${displayProgressTotal}`}>
        <div>
          <span>{getStageLabel(currentStep)}</span>
          <strong>
            {displayProgressCurrent} / {displayProgressTotal}
          </strong>
        </div>
        <div className="lesson-progress-track">
          <span style={{ width: `${currentProgress}%` }} />
        </div>
      </section>

      <section className="lesson-word-card">
        <span className="lesson-new-chip">{isStudyStep ? '新词' : isChooseStep ? '辨义' : '拼写'}</span>
        <p className="lesson-stage">{getStageLabel(currentStep)}</p>
        <h1>{currentStep.word.word}</h1>
        <p className="lesson-phonetic">{phonetic || '/.../'}</p>
        <p className="lesson-meaning">{meaningLine}</p>

        <div className="lesson-audio-row" aria-label="播放控制">
          <button className="lesson-audio-button" type="button" onClick={() => void playCurrentWord()}>
            <span className="lesson-audio-icon lesson-audio-icon-play" aria-hidden="true" />
            <strong>播放发音</strong>
          </button>
          <button className="lesson-audio-button lesson-audio-button-slow" type="button" onClick={() => void playSlowWord()}>
            <img className="lesson-slow-icon-image" src="/images/ui-ipad/slow-turtle-icon.png" alt="" aria-hidden="true" />
            <strong>慢速播放</strong>
          </button>
        </div>

        <button
          className="lesson-speech-button"
          type="button"
          onClick={() => void runSpeechCheck()}
          disabled={speechChecking || !speechRecognitionSupported}
        >
          {speechChecking ? '正在听你读...' : speechRecognitionSupported ? '跟读判定' : '当前浏览器不支持跟读'}
        </button>

        {isSpellStep ? (
          <label className="lesson-spell-field" htmlFor="dictation-spell-input">
            <span>点击输入你听到的单词</span>
            <input
              id="dictation-spell-input"
              value={spellingInput}
              onChange={(event) => setSpellingInput(event.target.value)}
              placeholder={currentStep.mask}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={Boolean(feedback)}
            />
          </label>
        ) : (
          <div className="lesson-answer-placeholder">点击输入你听到的单词</div>
        )}

        {isChooseStep ? (
          <div className="lesson-choice-grid">
            {currentStep.options.map((option) => (
              <button
                key={`${currentStep.id}-${option}`}
                className={getChoiceOptionClassName(option)}
                type="button"
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

        <p className="lesson-hint">
          <strong>提示：</strong>
          {hintText}
        </p>
        <img className="lesson-heart-image" src="/images/ui-ipad/heart-bubble.png" alt="" aria-hidden="true" />

        {speechCheckMessage ? <p className={speechCheckClassName}>{speechCheckMessage}</p> : null}
        {feedback ? <p className="feedback">{feedback}</p> : null}

        {spellingFeedbackData && !spellingFeedbackData.isCorrect ? (
          <div className="spelling-feedback-panel lesson-spelling-feedback">
            <p className="spelling-feedback-label">你写的：</p>
            <div className="spelling-feedback-word" aria-label="你写的单词逐字对比">
              {spellingFeedbackData.typedLetters.map((letter, index) => (
                <span
                  key={`typed-${currentStep.id}-${index}-${letter.char}`}
                  className={`spelling-feedback-letter ${letter.isWrong ? 'spelling-feedback-letter-wrong' : ''}`}
                >
                  {letter.char}
                </span>
              ))}
            </div>

            <p className="spelling-feedback-label spelling-feedback-label-correct">正确单词：</p>
            <div className="spelling-feedback-word spelling-feedback-word-correct" aria-label="正确单词">
              {Array.from(currentStep.word.word).map((letter, index) => (
                <span key={`answer-${currentStep.id}-${index}-${letter}`} className="spelling-feedback-letter spelling-feedback-letter-correct">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <img className="lesson-dog-image" src="/images/ui-ipad/dog.png" alt="" aria-hidden="true" />
      </section>

      <div className="lesson-bottom-action">
        <Button
          className="lesson-primary-action"
          onClick={submitStep}
          disabled={
            (isChooseStep && !selectedMeaning && !feedback) ||
            (isSpellStep && spellingInput.trim().length === 0 && !feedback)
          }
        >
          ✓ {primaryLabel}
        </Button>
        <button className="lesson-skip-action" type="button" onClick={skipStep}>
          不会
        </button>
      </div>
    </main>
  );
}

