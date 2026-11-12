import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ExampleSentences } from '../components/ExampleSentences';
import { ProgressBar } from '../components/ProgressBar';
import { questionBank } from '../data/loadQuestionBank';
import {
  fetchUsPhonetic,
  getLocalSlowWordAudioFeedback,
  getLocalWordAudioFeedback,
  preloadLocalUsSlowWordAudio,
  playLocalQuestionBankAudio,
  playLocalUsSlowWordAudio,
  playLocalUsWordAudio,
  playUsWordAudio,
  stopUsWordAudioPlayback,
} from '../lib/phonetic';
import {
  assessSpokenText,
  getSpeechRecognitionErrorMessage,
  isSpeechRecognitionSupported,
  recognizeSpeechOnce,
} from '../lib/speechAssessment';
import { pickDailyQuestions, pickPracticeSessionQuestions } from '../lib/practiceUtils';
import { getSavedExampleReview } from '../lib/practiceExampleReview';
import { buildTranslationQuestion, canRevealPracticeAnswer, getPracticeCardTitle } from '../lib/practiceDisplay';
import { getLegacyPracticeQuestionIds, getSavedPracticeQuestionIds } from '../lib/practiceSession';
import { getPendingReviewQuestionIds } from '../lib/reviewProgress';
import { selectReviewQuestions, type ReviewKind } from '../lib/reviewSelection';
import { recordCompletedTraining } from '../lib/learningRecords';
import { createSession, loadState, saveState } from '../lib/storage';
import { playWrongAnswerTone, updateWrongBookForQuestion } from '../lib/studyFeedback';
import { fetchWordImage } from '../lib/wordImage';
import { buildSpellingFeedback } from '../lib/spellingFeedback';
import type { Question, SessionAnswer } from '../types/schema';

type TrainMode =
  | 'normal'
  | 'random'
  | 'zh2en'
  | 'audio'
  | 'wrongFirst'
  | 'spelling'
  | 'initial'
  | 'dialogueFill'
  | 'qaMatch'
  | 'person'
  | 'daily20'
  | 'today10'
  | 'level10'
  | 'spaced'
  | 'weekly';

const DAILY_DICTATION_TAG = 'daily-dictation';
const REVIEW_KINDS: Partial<Record<TrainMode, ReviewKind>> = {
  daily20: 'daily',
  weekly: 'weekly',
  wrongFirst: 'wrongFirst',
  spaced: 'spaced',
};
const PREFERRED_US_VOICE_NAMES = [
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Samantha',
];

const TRAIN_TITLE_MAP: Record<string, string> = {
  normal: '标准',
  random: '随机',
  zh2en: '中译英',
  audio: '听力',
  wrongFirst: '错题优先',
  spelling: '拼写',
  initial: '首字母',
  dialogueFill: '对话填空',
  qaMatch: '问答匹配',
  person: '人称转换',
  daily20: '每日10题',
  today10: '今日10分钟',
  level10: '等级10题',
  spaced: '间隔复习',
  weekly: '一周再背',
};

function getTrainTitle(train: string): string {
  return TRAIN_TITLE_MAP[train] || '标准训练';
}

function pickUsVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const preferredName of PREFERRED_US_VOICE_NAMES) {
    const exactMatch = voices.find((voice) => voice.name === preferredName);
    if (exactMatch) return exactMatch;
  }

  return (
    voices.find((voice) => voice.lang === 'en-US') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en-us')) ??
    voices.find((voice) => {
      const name = voice.name.toLowerCase();
      return name.includes('us english') || name.includes('american') || name.includes('samantha');
    }) ??
    null
  );
}

function pickDailyLearningSet(bank: Question[], count: number): Question[] {
  const preferredBank = bank.filter((item) => item.tags.includes(DAILY_DICTATION_TAG));
  if (!preferredBank.length) {
    return pickDailyQuestions(bank, count);
  }

  const preferredQuestions = pickDailyQuestions(preferredBank, count);
  if (preferredQuestions.length >= count) {
    return preferredQuestions;
  }

  const pickedIds = new Set(preferredQuestions.map((item) => item.id));
  const fallbackBank = bank.filter((item) => !pickedIds.has(item.id));
  const fallback = pickDailyQuestions(fallbackBank, count - preferredQuestions.length);
  return [...preferredQuestions, ...fallback];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function maskWord(word: string): string {
  if (word.length <= 3) return `${word[0]} _ _`;
  const chars = word.split('');
  return chars.map((ch, i) => (i === 0 || i === chars.length - 1 ? ch : '_')).join(' ');
}

function personTransform(text: string): string {
  return text
    .replace(/^I\s+/i, 'He ')
    .replace(/\bthrow\b/gi, 'throws')
    .replace(/\bcatch\b/gi, 'catches')
    .replace(/\bhit\b/gi, 'hits')
    .replace(/\bkick\b/gi, 'kicks')
    .replace(/\bplay\b/gi, 'plays')
    .replace(/\bam\b/gi, 'is');
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractDialogueKeyword(sentence: string): string {
  const words = sentence
    .replace(/[^a-zA-Z']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return words[1].toLowerCase();
  if (words.length === 1) return words[0].toLowerCase();
  return sentence.trim().toLowerCase();
}

function scoreSimilarity(source: Question, candidate: Question): number {
  const tagSet = new Set(source.tags);
  let score = 0;

  candidate.tags.forEach((tag) => {
    if (tagSet.has(tag)) score += 1;
  });

  if (candidate.type === source.type) score += 2;
  return score;
}

function pickReinforcementQuestionId(
  question: Question,
  questionFlow: number[],
  questionIndex: number,
  questionById: Map<number, Question>,
): number | null {
  const futureIds = questionFlow.slice(questionIndex + 1);
  let bestId: number | null = null;
  let bestScore = 0;

  futureIds.forEach((id) => {
    const candidate = questionById.get(id);
    if (!candidate) return;
    const score = scoreSimilarity(question, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });

  return bestScore > 0 ? bestId : null;
}

function moveFutureQuestionToNext(questionFlow: number[], questionIndex: number, questionId: number): number[] {
  const fromIndex = questionFlow.findIndex((id, idx) => idx > questionIndex && id === questionId);
  if (fromIndex === -1 || fromIndex === questionIndex + 1) {
    return questionFlow;
  }

  const next = [...questionFlow];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(questionIndex + 1, 0, moved);
  return next;
}

function getAudioText(question: Question): string {
  return (question.audioText || question.prompt || '').trim();
}

function isVocabQuestion(question: Question): boolean {
  return question.tags.includes('vocab-qa') || question.tags.includes('vocab');
}

function isSingleEnglishWord(word: string): boolean {
  return /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(word.trim());
}

export function PracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') || 'all') as 'all' | 'vocab' | 'dialogue';
  const train = (searchParams.get('train') || 'normal') as TrainMode;
  const reviewTaskId = train === 'spaced' ? searchParams.get('task') || undefined : undefined;

  const [selectionNow] = useState(() => new Date());
  const [questionFlow, setQuestionFlow] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [sessionRestartMessage, setSessionRestartMessage] = useState('');
  const [submittedExampleQuestionId, setSubmittedExampleQuestionId] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [listenRate, setListenRate] = useState(1);
  const [sentenceCursor, setSentenceCursor] = useState(0);
  const [phonetic, setPhonetic] = useState('');
  const [spellingInput, setSpellingInput] = useState('');
  const [wordImageUrl, setWordImageUrl] = useState('');
  const [wordImageLoading, setWordImageLoading] = useState(false);
  const [speechChecking, setSpeechChecking] = useState(false);
  const [speechCheckMessage, setSpeechCheckMessage] = useState('');
  const [speechCheckPassed, setSpeechCheckPassed] = useState<boolean | null>(null);
  const autoPlayAfterSubmitRef = useRef(false);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const currentBank = useMemo(() => {
    const stateSnapshot = loadState();

    let bank = questionBank;
    if (mode === 'vocab') {
      bank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
    } else if (mode === 'dialogue') {
      bank = bank.filter((q) => q.tags.includes('dialogue-qa') || q.tags.includes('dialogue'));
    }

    if (reviewTaskId) {
      const task = stateSnapshot.reviewTasks.find((item) => item.id === reviewTaskId);
      if (!task || task.completed || !(new Date(task.dueAt).getTime() <= selectionNow.getTime())) return [];
      const pendingIds = new Set(getPendingReviewQuestionIds(task));
      bank = bank.filter((question) => pendingIds.has(question.id));
    }

    const savedIds = getSavedPracticeQuestionIds(stateSnapshot.activeSession, bank, { mode, train, reviewTaskId });
    if (savedIds) {
      const questionsById = new Map(bank.map((question) => [question.id, question]));
      bank = savedIds.map((id) => questionsById.get(id)!);
    }

    const reviewKind = REVIEW_KINDS[train];
    if (reviewKind) {
      return savedIds ? bank : selectReviewQuestions(bank, stateSnapshot, { kind: reviewKind, now: selectionNow });
    }

    if (train === 'today10' && !savedIds) {
      bank = pickDailyLearningSet(bank, 10);
    }

    if (train === 'level10' && !savedIds) {
      bank = bank.slice(0, 10);
    }

    if (train === 'random' && !savedIds) {
      bank = shuffleArray(bank);
    }

    if (train === 'zh2en') {
      const vocabBank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
      const vocabularyPool = questionBank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
      bank = vocabBank.map((question) => buildTranslationQuestion(question, vocabularyPool));
    }

    if (train === 'spelling') {
      const vocabBank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
      bank = vocabBank.map((q) => ({
        ...q,
        type: 'spell' as const,
        stem: `拼写提示：${maskWord(q.prompt)}`,
        options: [],
        answerIndex: 0,
      }));
    }

    if (train === 'initial') {
      const vocabBank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
      bank = vocabBank.map((q) => ({
        ...q,
        stem: `首字母提示：${q.prompt[0]} _ _ _`,
      }));
    }

    if (train === 'dialogueFill') {
      const dialogueBank = bank.filter((q) => q.tags.includes('dialogue-qa') || q.tags.includes('dialogue'));
      const keywordPool = dialogueBank
        .map((q) => q.options[q.answerIndex])
        .map((sentence) => extractDialogueKeyword(sentence || ''))
        .filter(Boolean);

      bank = dialogueBank.map((q) => {
        const answerSentence = q.options[q.answerIndex] ?? '';
        const cleanAnswer = answerSentence.replace(/[.?!]/g, '').trim();
        const answerWords = cleanAnswer.split(/\s+/).filter(Boolean);
        const blankIndex = answerWords.length >= 2 ? 1 : 0;
        const correctWord = extractDialogueKeyword(answerSentence);
        const displayWords = [...answerWords];
        if (displayWords.length > 0) {
          displayWords[blankIndex] = '_____';
        }

        const distractors = shuffleArray(keywordPool.filter((word) => word !== correctWord)).slice(0, 3);
        const options = shuffleArray(Array.from(new Set([correctWord, ...distractors]))).slice(0, 4);

        if (!options.includes(correctWord)) {
          options[0] = correctWord;
        }

        return {
          ...q,
          stem: `对话填空：${q.prompt} ${displayWords.join(' ')}。`,
          options,
          answerIndex: options.indexOf(correctWord),
        };
      });
    }

    if (train === 'qaMatch') {
      const dialogueBank = bank.filter((q) => q.tags.includes('dialogue-qa') || q.tags.includes('dialogue'));
      const questionPool = dialogueBank.map((q) => q.prompt);

      bank = dialogueBank.map((q) => {
        const correctQuestion = q.prompt;
        const answerSentence = q.options[q.answerIndex] ?? q.prompt;
        const distract = shuffleArray(questionPool.filter((item) => item !== correctQuestion)).slice(0, 3);
        const options = shuffleArray([correctQuestion, ...distract]);

        return {
          ...q,
          prompt: answerSentence,
          stem: '问答匹配：请选择与这个回答匹配的问题。',
          options,
          answerIndex: options.indexOf(correctQuestion),
        };
      });
    }

    if (train === 'person') {
      bank = bank.filter((q) => q.tags.includes('dialogue-qa') || q.tags.includes('verb') || q.tags.includes('grammar'));
      bank = bank.map((q) => {
        const transformed = personTransform(q.prompt);
        const options = shuffleArray(Array.from(new Set([transformed, q.prompt, 'They throw the ball.', 'We throw the ball.']))).slice(0, 4);
        if (!options.includes(transformed)) {
          options[0] = transformed;
        }

        return {
          ...q,
          stem: `人称转换：把“${q.prompt}”改成第三人称单数。`,
          options,
          answerIndex: options.indexOf(transformed),
        };
      });
    }

    return savedIds ? bank : pickPracticeSessionQuestions(bank);
  }, [mode, train, reviewTaskId, selectionNow]);

  const reviewFocusCount = useMemo(() => {
    const wrongIds = new Set(loadState().wrongBook.filter((item) => !item.mastered).map((item) => item.questionId));
    return currentBank.filter((question) => wrongIds.has(question.id)).length;
  }, [currentBank]);

  const questionById = useMemo(() => {
    const map = new Map<number, Question>();
    currentBank.forEach((q) => map.set(q.id, q));
    return map;
  }, [currentBank]);

  useEffect(() => {
    if (!currentBank.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestionFlow([]);
      setQuestionIndex(0);
      return;
    }
    const state = loadState();
    const previousSession = state.activeSession;
    const scope = { mode, train, reviewTaskId };
    const savedFlow = getSavedPracticeQuestionIds(previousSession, currentBank, scope);
    const legacyFlow = getLegacyPracticeQuestionIds(previousSession, currentBank, scope);
    const flow = savedFlow ?? legacyFlow ?? currentBank.map((question) => question.id);
    const shouldResetSession = !savedFlow && !legacyFlow;
    const isSameEntry = previousSession?.mode === mode && previousSession.train === train
      && previousSession.reviewTaskId === reviewTaskId;

    if (shouldResetSession) {
      state.activeSession = createSession();
    }

    const activeSession = state.activeSession ?? createSession();
    state.activeSession = activeSession;

    activeSession.mode = mode;
    activeSession.train = train;
    activeSession.reviewTaskId = reviewTaskId;
    activeSession.questionIds = [...flow];
    activeSession.questionTotal = flow.length;
    activeSession.currentQuestionIndex = Math.min(
      legacyFlow ? new Set(activeSession.answers.map((answer) => answer.questionId)).size : activeSession.currentQuestionIndex,
      Math.max(flow.length - 1, 0),
    );

    saveState(state);

    setSessionRestartMessage(shouldResetSession && isSameEntry && previousSession?.answers.length
      ? '本轮题目已更新，已重新安排练习；以前的错题记录仍然保留。'
      : '');
    setQuestionFlow(flow);
    setQuestionIndex(activeSession.currentQuestionIndex);
    setSelected(null);
    setFeedback('');
    setStreak(0);
    setListenRate(1);
    setSentenceCursor(0);
    setSpellingInput('');
    setWordImageUrl('');
    setWordImageLoading(false);
    setSpeechChecking(false);
    setSpeechCheckMessage('');
    setSpeechCheckPassed(null);
    autoPlayAfterSubmitRef.current = false;
  }, [currentBank, mode, train, reviewTaskId]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const syncPreferredVoice = () => {
      const nextVoice = pickUsVoice(window.speechSynthesis.getVoices());
      if (nextVoice) {
        preferredVoiceRef.current = nextVoice;
      }
    };

    syncPreferredVoice();
    window.speechSynthesis.addEventListener('voiceschanged', syncPreferredVoice);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', syncPreferredVoice);
    };
  }, []);

  const totalCount = questionFlow.length;
  const currentQuestionId = questionFlow[questionIndex];
  const question = currentQuestionId !== undefined ? questionById.get(currentQuestionId) : undefined;
  const speechRecognitionSupported = isSpeechRecognitionSupported();
  const isSpellingQuestion = train === 'spelling';
  const isChoiceQuestion = !isSpellingQuestion && Boolean(question && question.type === 'single_choice' && question.options.length > 0);

  useEffect(() => {
    if (!question) return;

    const state = loadState();
    const session = state.activeSession;
    const existed = session?.answers.find((a) => a.questionId === question.id);
    const savedExampleReview = getSavedExampleReview(question, existed, Boolean(REVIEW_KINDS[train]) || train === 'zh2en');

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(existed && existed.selectedIndex >= 0 ? existed.selectedIndex : null);
    setFeedback(savedExampleReview?.feedback ?? '');
    setSubmittedExampleQuestionId(savedExampleReview?.questionId ?? null);
    setSpellingInput(savedExampleReview?.spellingInput ?? '');
    setSpeechChecking(false);
    setSpeechCheckMessage('');
    setSpeechCheckPassed(null);
  }, [question, train]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSentenceCursor(0);
  }, [question]);

  useEffect(() => {
    if (!question || !isVocabQuestion(question) || !isSingleEnglishWord(question.prompt)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhonetic('');
      return;
    }

    if (question.phonetic) return;

    let canceled = false;
    fetchUsPhonetic(question.prompt).then((result) => {
      if (canceled) return;
      setPhonetic(result ?? '');
    });

    return () => {
      canceled = true;
    };
  }, [question]);

  useEffect(() => {
    if (!question) return;
    if (!question.tags.includes(DAILY_DICTATION_TAG) && !question.tags.includes('archived-dictation')) return;
    if (!isSingleEnglishWord(question.prompt)) return;
    void preloadLocalUsSlowWordAudio(question.audioKey ?? question.prompt);
  }, [question]);

  useEffect(() => {
    if (!question || !isSpellingQuestion || !isSingleEnglishWord(question.prompt)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWordImageUrl('');
      setWordImageLoading(false);
      return;
    }

    let canceled = false;
    setWordImageLoading(true);
    fetchWordImage(question.prompt, question.explanation).then((url) => {
      if (canceled) return;
      setWordImageUrl(url ?? '');
      setWordImageLoading(false);
    });

    return () => {
      canceled = true;
    };
  }, [question, isSpellingQuestion]);

  const audioText = question ? getAudioText(question) : '';
  const sentenceList = splitSentences(audioText);

  const speakAudio = useCallback(async (text: string, rate: number) => {
    if (!text) return;
    if (!canRevealPracticeAnswer(train, submittedExampleQuestionId === question?.id)) return;

    const isDailyDictationWord = Boolean(question?.tags.includes(DAILY_DICTATION_TAG) || question?.tags.includes('archived-dictation'));
    if (isDailyDictationWord) {
      const audioKey = question?.audioKey ?? text;
      if (rate < 1) {
        const playback = await playLocalUsSlowWordAudio(audioKey);
        if (playback.ok || playback.reason === 'stale') return;
        const nextFeedback = getLocalSlowWordAudioFeedback(playback);
        if (nextFeedback) setFeedback(nextFeedback);
        return;
      }

      const playback = await playLocalUsWordAudio(audioKey);
      if (playback.ok || playback.reason === 'stale') return;
      setFeedback(getLocalWordAudioFeedback(playback));
      return;
    }

    const localQuestionBankPlayback = await playLocalQuestionBankAudio(text, rate);
    if (localQuestionBankPlayback.ok || localQuestionBankPlayback.reason === 'stale') return;

    if (isSingleEnglishWord(text)) {
      const playback = await playUsWordAudio(text, rate);
      if (playback.ok || playback.reason === 'stale') return;
    }

    if (rate < 1) {
      setFeedback('当前内容的慢速音频暂不可用，请先听正常发音。');
      return;
    }

    if (!('speechSynthesis' in window)) {
      setFeedback('当前浏览器不支持语音朗读。');
      return;
    }

    stopUsWordAudioPlayback();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const usVoice = preferredVoiceRef.current ?? pickUsVoice(voices);
    if (usVoice) utterance.voice = usVoice;
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, [question, submittedExampleQuestionId, train]);

  useEffect(() => {
    if (!autoPlayAfterSubmitRef.current) return;

    autoPlayAfterSubmitRef.current = false;
    if (!question || !isVocabQuestion(question)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void speakAudio(audioText, 1);
  }, [audioText, question, speakAudio]);

  useEffect(() => {
    return () => {
      stopUsWordAudioPlayback();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!question || totalCount === 0) {
    return (
      <main className="reference-page practice-learning-page">
        <Link className="practice-back-button" to="/" aria-label="返回首页">
          返回首页
        </Link>
        <p>{reviewTaskId ? '这项任务已完成、尚未到期，或暂无可复习内容。' : train === 'weekly' || train === 'spaced' ? '暂时没有可复习的旧词，先完成一轮单词学习吧。' : '当前模式暂无可练习内容。'}</p>
        {REVIEW_KINDS[train] ? <Link to="/review">查看复习安排</Link> : null}
      </main>
    );
  }

  const playFullAudio = (rate: number) => {
    setListenRate(rate);
    void speakAudio(audioText, rate);
  };

  const repeatSingleSentence = () => {
    if (!sentenceList.length) {
      void speakAudio(audioText, listenRate);
      return;
    }

    const index = sentenceCursor % sentenceList.length;
    void speakAudio(sentenceList[index], listenRate);
    setSentenceCursor((prev) => (prev + 1) % sentenceList.length);
  };

  const runSpeechCheck = async () => {
    if (!question) return;
    if (!canRevealPracticeAnswer(train, submittedExampleQuestionId === question.id)) return;

    const targetText = getAudioText(question).trim();
    if (!targetText) {
      setSpeechCheckPassed(false);
      setSpeechCheckMessage('当前题目没有可跟读文本。');
      return;
    }

    if (!speechRecognitionSupported) {
      setSpeechCheckPassed(false);
      setSpeechCheckMessage('当前浏览器不支持语音识别。iPad 请使用 Safari，并确认已开启 Siri。');
      return;
    }

    stopUsWordAudioPlayback();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

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

    const assessment = assessSpokenText(targetText, attempt.transcript);
    setSpeechChecking(false);
    setSpeechCheckPassed(assessment.passed);
    setSpeechCheckMessage(
      `识别到：${attempt.transcript}。匹配度 ${assessment.score}% · ${assessment.passed ? '判定通过' : '再读一次会更好。'}`,
    );
  };

  const advanceAfterAnswer = (nextFeedback = feedback, flow = questionFlow) => {
    const state = loadState();
    const session = state.activeSession;
    if (!session) {
      setFeedback('学习记录暂不可用，请刷新后重试。');
      return;
    }

    stopUsWordAudioPlayback();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const nextIndex = Math.min(questionIndex + 1, Math.max(flow.length - 1, 0));
    session.currentQuestionIndex = nextIndex;
    session.questionIds = [...flow];

    if (questionIndex >= flow.length - 1) {
      const finishedAt = new Date().toISOString();
      const finishedSession = { ...session, finishedAt };
      const nextState = recordCompletedTraining(
        {
          ...state,
          activeSession: null,
          sessions: [finishedSession, ...state.sessions.filter((item) => item.id !== finishedSession.id)].slice(0, 30),
        },
        {
          id: session.id,
          source: 'practice',
          train,
          mode,
          title: getTrainTitle(train),
          startedAt: session.startedAt,
          finishedAt,
          questionTotal: session.questionTotal ?? totalCount,
          answers: session.answers.map((answer) => ({ ...answer, kind: 'practice' as const })),
        },
      );
      saveState(nextState);
      navigate('/result');
      return;
    }

    saveState(state);
    const nextQuestionId = flow[nextIndex];
    const nextQuestion = nextQuestionId !== undefined ? questionById.get(nextQuestionId) : undefined;
    autoPlayAfterSubmitRef.current = Boolean(nextQuestion && isVocabQuestion(nextQuestion));
    setFeedback(nextFeedback);
    setQuestionIndex(nextIndex);
  };

  const moveToQuestion = (nextIndex: number) => {
    const state = loadState();
    if (!state.activeSession || state.activeSession.mode !== mode || state.activeSession.train !== train
      || state.activeSession.reviewTaskId !== reviewTaskId) {
      setFeedback('学习记录暂不可用，请刷新后重试。');
      return;
    }
    stopUsWordAudioPlayback();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.activeSession.currentQuestionIndex = nextIndex;
    state.activeSession.questionIds = [...questionFlow];
    saveState(state);
    setFeedback('');
    setSpeechCheckMessage('');
    setSpeechCheckPassed(null);
    autoPlayAfterSubmitRef.current = false;
    setQuestionIndex(nextIndex);
  };

  const goPrev = () => {
    if (questionIndex === 0) return;
    moveToQuestion(questionIndex - 1);
  };

  const goNext = () => {
    if (submittedExampleQuestionId === question.id) {
      advanceAfterAnswer();
      return;
    }
    if (questionIndex >= totalCount - 1) return;
    moveToQuestion(questionIndex + 1);
  };

  const submit = () => {
    if (submittedExampleQuestionId === question.id) {
      advanceAfterAnswer();
      return;
    }
    if (isChoiceQuestion && selected === null) return;
    if (isSpellingQuestion && spellingInput.trim().length === 0) return;

    const state = loadState();
    const hasCompatibleSession =
      Boolean(state.activeSession) &&
      state.activeSession?.mode === mode &&
      state.activeSession?.train === train &&
      state.activeSession?.reviewTaskId === reviewTaskId &&
      state.activeSession.answers.every((answer) => questionById.has(answer.questionId));

    const session = hasCompatibleSession && state.activeSession ? state.activeSession : createSession();
    const savedExampleReview = getSavedExampleReview(question, session.answers.find((answer) => answer.questionId === question.id), Boolean(REVIEW_KINDS[train]) || train === 'zh2en');
    if (savedExampleReview) {
      setSubmittedExampleQuestionId(savedExampleReview.questionId);
      setFeedback(savedExampleReview.feedback);
      setSpellingInput(savedExampleReview.spellingInput);
      return;
    }
    const selectedIndex = isChoiceQuestion ? (selected ?? 0) : isSpellingQuestion ? -1 : 0;
    const isCorrect = isSpellingQuestion
      ? buildSpellingFeedback(spellingInput, question.prompt).isCorrect
      : isChoiceQuestion
        ? selectedIndex === question.answerIndex
        : true;

    const answerPayload: SessionAnswer = {
      questionId: question.id,
      selectedIndex,
      isCorrect,
      answeredAt: new Date().toISOString(),
    };

    const answerIndex = session.answers.findIndex((a) => a.questionId === question.id);
    if (answerIndex >= 0) session.answers[answerIndex] = answerPayload;
    else session.answers.push(answerPayload);

    session.score = session.answers.filter((a) => a.isCorrect).length;
    session.accuracy = totalCount > 0 ? session.score / totalCount : 0;
    session.questionTotal = totalCount;
    session.mode = mode;
    session.train = train;
    session.reviewTaskId = reviewTaskId;

    let nextFeedback = '';
    let nextFlow = questionFlow;

    if (!isCorrect) {
      const now = new Date();
      const feedbackState = updateWrongBookForQuestion(state.wrongBook, state.reviewTasks, question.id, now);
      state.wrongBook = feedbackState.wrongBook;
      state.reviewTasks = feedbackState.reviewTasks;
      setStreak(0);
      playWrongAnswerTone();

      nextFeedback = isSpellingQuestion
        ? `答错了，正确拼写是 ${question.prompt}。`
        : `答错了，正确答案是 ${String.fromCharCode(65 + question.answerIndex)}。`;

      const reinforcementId = pickReinforcementQuestionId(question, questionFlow, questionIndex, questionById);
      if (reinforcementId !== null) {
        const reorderedFlow = moveFutureQuestionToNext(questionFlow, questionIndex, reinforcementId);
        if (reorderedFlow !== questionFlow) {
          nextFlow = reorderedFlow;
          setQuestionFlow(reorderedFlow);
          nextFeedback += question.examples?.length || REVIEW_KINDS[train] || train === 'zh2en' ? ' 下一题会练习相似内容。' : ' 已为你切换到相似题继续练习。';
        }
      }
    } else {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      nextFeedback = nextStreak >= 3 ? `连续答对 ${nextStreak} 题，真棒！` : '回答正确。';
    }

    state.activeSession = session;
    session.currentQuestionIndex = questionIndex;
    session.questionIds = [...nextFlow];
    saveState(state);
    if ((question.examples?.length || REVIEW_KINDS[train] || train === 'zh2en') && (isChoiceQuestion || isSpellingQuestion)) {
      setSubmittedExampleQuestionId(question.id);
      setFeedback(nextFeedback);
      return;
    }
    advanceAfterAnswer(nextFeedback, nextFlow);
  };

  const modeTitle = mode === 'vocab' ? '词汇' : mode === 'dialogue' ? '对话' : '全部';
  const hasSubmittedExampleQuestion = submittedExampleQuestionId === question.id;
  const canRevealAnswer = canRevealPracticeAnswer(train, hasSubmittedExampleQuestion);
  const cardTitle = getPracticeCardTitle(train, question, hasSubmittedExampleQuestion);

  const cardSubtitle = train === 'audio' ? '听音后选择正确选项' : question.stem;
  const displayedPhonetic = question.phonetic || phonetic;

  const submitDisabled = hasSubmittedExampleQuestion ? false : isChoiceQuestion
    ? selected === null
    : isSpellingQuestion
      ? spellingInput.trim().length === 0
      : false;
  const speechCheckClassName = speechCheckPassed === null
    ? 'speech-check'
    : speechCheckPassed
      ? 'speech-check speech-check-pass'
      : 'speech-check speech-check-warn';

  return (
    <main className="reference-page practice-learning-page">
      <Link className="practice-back-button" to="/" aria-label="返回首页">
        返回首页
      </Link>
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">练习模式</p>
        <h1>{modeTitle}训练</h1>
        <p className="page-lead">
          当前训练：{getTrainTitle(train)}。{train === 'audio' ? '先听，再判断。' : '按当前节奏稳稳往前做。'}
        </p>
        <div className="badge-row">
          <span className="info-pill">共 {totalCount} 题</span>
          {REVIEW_KINDS[train] ? <span className="info-pill">本轮包含 {reviewFocusCount} 个待巩固错词</span> : null}
          <span className="info-pill">连续答对 {streak} 题</span>
          <span className={`info-pill ${speechRecognitionSupported ? '' : 'info-pill-warn'}`}>
            {speechRecognitionSupported ? '支持跟读判定' : '当前浏览器不支持跟读'}
          </span>
        </div>
        {REVIEW_KINDS[train] ? (
          <p className="field-note">{reviewTaskId ? '完成本轮后，答对的词会计入这项到期任务的进度。' : train === 'wrongFirst' ? '优先练习尚未掌握的错题，错题不足时穿插旧词巩固。' : '错词充足时，每 10 题约 7 题优先复习错词，其余旧词穿插巩固。'}答对会降低后续复习优先级，反复出错的词会优先再练。</p>
        ) : null}
        <img className="practice-hero-illustration" src="/images/ui-ipad/hero-child-rabbit.png" alt="" aria-hidden="true" />
      </section>
      {sessionRestartMessage ? <p className="field-note" role="status">{sessionRestartMessage}</p> : null}
      <ProgressBar current={questionIndex + 1} total={totalCount} />
      <Card className={isSpellingQuestion ? 'card-tone-yellow' : 'card-tone-blue'} title={cardTitle} subtitle={cardSubtitle}>
        <div className="card-chip-row">
          <span className="section-chip">{getTrainTitle(train)}</span>
          {question.grammarLabel ? <span className="section-chip section-chip-grammar">{question.grammarLabel}</span> : null}
          <span className="muted">
            第 {questionIndex + 1} 题 / 共 {totalCount} 题
          </span>
        </div>
        <img className="practice-card-dog" src="/images/ui-ipad/dog.png" alt="" aria-hidden="true" />
        {canRevealAnswer && displayedPhonetic ? <p className="field-note">美式音标：{displayedPhonetic}</p> : null}
        {(!isChoiceQuestion && !isSpellingQuestion || hasSubmittedExampleQuestion) && (question.partOfSpeech || question.sources?.length) ? (
          <p className="word-learning-metadata">{[question.partOfSpeech, question.sources?.join(' · ')].filter(Boolean).join(' · ')}</p>
        ) : null}

        {canRevealAnswer ? <div className="listen-controls">
          <Button variant="ghost" onClick={() => playFullAudio(1)}>
            正常
          </Button>
          <Button variant="ghost" onClick={() => playFullAudio(0.75)}>
            慢速
          </Button>
          <Button variant="ghost" onClick={repeatSingleSentence}>
            逐句重复
          </Button>
          <Button variant="ghost" onClick={() => void runSpeechCheck()} disabled={speechChecking || !speechRecognitionSupported}>
            {speechChecking ? '识别中...' : '跟读判定'}
          </Button>
        </div> : <p className="field-note">先选出正确英文，提交后可以听发音和跟读。</p>}
        {speechCheckMessage ? <p className={speechCheckClassName}>{speechCheckMessage}</p> : null}
        {!speechRecognitionSupported ? (
          <p className="speech-check speech-check-warn">当前浏览器不支持语音识别。iPad 请使用 Safari，并确认已开启 Siri。</p>
        ) : null}

        {isSpellingQuestion ? (
          <div className="learning-block">
            {wordImageUrl ? (
              <img className="spelling-image" src={wordImageUrl} alt="单词提示图" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <p className="muted">{wordImageLoading ? '图片加载中...' : '暂未找到对应图片'}</p>
            )}

            <label className="spelling-label" htmlFor="spelling-input">
              请输入英文拼写：
            </label>
            <input
              id="spelling-input"
              className="spelling-input"
              value={spellingInput}
              onChange={(event) => setSpellingInput(event.target.value)}
              placeholder="输入单词"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={hasSubmittedExampleQuestion}
            />
          </div>
        ) : isChoiceQuestion ? (
          <div className="options">
            {question.options.map((op, idx) => (
              <button
                key={`${question.id}-${op}`}
                className={`option ${selected === idx ? 'option-selected' : ''}`}
                onClick={() => setSelected(idx)}
                disabled={hasSubmittedExampleQuestion}
              >
                {String.fromCharCode(65 + idx)}. {op}
              </button>
            ))}
          </div>
        ) : (
          <div className="learning-block">
            <p>学习内容：{question.stem}</p>
          </div>
        )}

        <ExampleSentences
          key={question.id}
          examples={question.examples}
          revealed={(!isChoiceQuestion && !isSpellingQuestion) || hasSubmittedExampleQuestion}
        />
        {feedback ? <p className="feedback">{feedback}</p> : null}

        <div className="practice-action-dock">
          <Button variant="secondary" onClick={goPrev} disabled={questionIndex === 0}>
            上一题
          </Button>
          <Button onClick={submit} disabled={submitDisabled}>
            {hasSubmittedExampleQuestion ? questionIndex >= totalCount - 1 ? '查看结果' : '下一题' : isChoiceQuestion || isSpellingQuestion ? '提交' : '我会了，下一题'}
          </Button>
          {!hasSubmittedExampleQuestion ? (
            <Button variant="secondary" onClick={goNext} disabled={questionIndex >= totalCount - 1}>
              下一题
            </Button>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
