import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { questionBank } from '../data/loadQuestionBank';
import { createSession, loadState, saveState } from '../lib/storage';
import { cloneReviewTasks, pickDailyQuestions, scheduleReviewTasks } from '../lib/practiceUtils';
import type { Question, ReviewTask, SessionAnswer, WrongItem } from '../types/schema';

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
  | 'spaced';

interface UndoSnapshot {
  questionId: number;
  questionIndex: number;
  selected: number | null;
  previousAnswer: SessionAnswer | null;
  previousWrongItem: WrongItem | null;
  previousSessionIndex: number;
  previousScore: number;
  previousAccuracy: number;
  previousStreak: number;
  previousFlow: number[];
  previousReviewTasks: ReviewTask[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractZh(explanation: string): string {
  const parts = explanation.split(/\s+/);
  if (parts.length >= 2) return parts.slice(1).join(' ');
  return explanation;
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

export function PracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') || 'all') as 'all' | 'vocab' | 'dialogue';
  const train = (searchParams.get('train') || 'normal') as TrainMode;
  const [nowForSpaced, setNowForSpaced] = useState(0);

  const currentBank = useMemo(() => {
    const stateSnapshot = loadState();
    const wrongIds = new Set(stateSnapshot.wrongBook.filter((x) => !x.mastered).map((x) => x.questionId));

    let bank = questionBank;
    if (mode === 'vocab') {
      bank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
    } else if (mode === 'dialogue') {
      bank = bank.filter((q) => q.tags.includes('dialogue-qa') || q.tags.includes('dialogue'));
    }

    if (train === 'wrongFirst') {
      const wrongPart = bank.filter((q) => wrongIds.has(q.id));
      const rest = bank.filter((q) => !wrongIds.has(q.id));
      bank = [...wrongPart, ...rest];
    }

    if (train === 'spaced') {
      const now = nowForSpaced;
      const dueIds = new Set(
        stateSnapshot.wrongBook
          .filter((w) => {
            const ageDays = Math.floor((now - new Date(w.lastWrongAt).getTime()) / (24 * 3600 * 1000));
            return ageDays === 1 || ageDays === 3 || ageDays >= 7;
          })
          .map((w) => w.questionId),
      );
      const duePart = bank.filter((q) => dueIds.has(q.id));
      bank = duePart.length ? duePart : bank;
    }

    if (train === 'today10') {
      bank = pickDailyQuestions(bank, 10);
    }

    if (train === 'daily20') {
      bank = pickDailyQuestions(bank, 20);
    }

    if (train === 'level10') {
      bank = bank.slice(0, 10);
    }

    if (train === 'random') {
      bank = shuffleArray(bank);
    }

    if (train === 'zh2en') {
      const vocabBank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
      const allWords = vocabBank.map((x) => x.prompt);
      bank = vocabBank.map((q) => {
        const correctZh = extractZh(q.explanation);
        const distract = shuffleArray(allWords.filter((w) => w !== q.prompt)).slice(0, 3);
        const options = shuffleArray([q.prompt, ...distract]);
        return {
          ...q,
          stem: `请选择“${correctZh}”对应的英文单词`,
          options,
          answerIndex: options.indexOf(q.prompt),
        };
      });
    }

    if (train === 'spelling') {
      const vocabBank = bank.filter((q) => q.tags.includes('vocab-qa') || q.tags.includes('vocab'));
      bank = vocabBank.map((q) => ({
        ...q,
        stem: `拼写提示：${maskWord(q.prompt)}`,
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

    return bank;
  }, [mode, train, nowForSpaced]);

  const questionById = useMemo(() => {
    const map = new Map<number, Question>();
    currentBank.forEach((q) => map.set(q.id, q));
    return map;
  }, [currentBank]);

  const [questionFlow, setQuestionFlow] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [streak, setStreak] = useState(0);
  const [listenRate, setListenRate] = useState(1);
  const [sentenceCursor, setSentenceCursor] = useState(0);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  useEffect(() => {
    const flow = currentBank.map((q) => q.id);
    const state = loadState();

    const flowIdSet = new Set(flow);
    const shouldResetSession =
      !state.activeSession ||
      state.activeSession.mode !== mode ||
      state.activeSession.train !== train ||
      state.activeSession.answers.some((answer) => !flowIdSet.has(answer.questionId));

    if (shouldResetSession) {
      state.activeSession = createSession();
    }

    const activeSession = state.activeSession ?? createSession();
    state.activeSession = activeSession;

    activeSession.mode = mode;
    activeSession.train = train;
    activeSession.questionTotal = flow.length;
    activeSession.currentQuestionIndex = Math.min(
      activeSession.currentQuestionIndex,
      Math.max(flow.length - 1, 0),
    );

    saveState(state);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestionFlow(flow);
    setQuestionIndex(activeSession.currentQuestionIndex);
    setSelected(null);
    setFeedback('');
    setStreak(0);
    setUndoSnapshot(null);
    setListenRate(1);
    setSentenceCursor(0);
  }, [currentBank, mode, train]);

  useEffect(() => {
    if (train === 'spaced') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNowForSpaced(Date.now());
    }
  }, [mode, train]);

  const totalCount = questionFlow.length;
  const currentQuestionId = questionFlow[questionIndex];
  const question = currentQuestionId !== undefined ? questionById.get(currentQuestionId) : undefined;
  const isChoiceQuestion = Boolean(question && question.type === 'single_choice' && question.options.length > 0);

  useEffect(() => {
    if (!question) return;

    const state = loadState();
    const session = state.activeSession;
    const existed = session?.answers.find((a) => a.questionId === question.id);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(existed ? existed.selectedIndex : null);
    setFeedback('');
  }, [question]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSentenceCursor(0);
  }, [question]);

  if (!question || totalCount === 0) {
    return <main className="page">当前模式暂无可练习内容。</main>;
  }

  const audioText = getAudioText(question);
  const sentenceList = splitSentences(audioText);

  const speakAudio = (text: string, rate: number) => {
    if (!text) return;
    if (!('speechSynthesis' in window)) {
      setFeedback('当前浏览器不支持语音朗读。');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  const playFullAudio = (rate: number) => {
    setListenRate(rate);
    speakAudio(audioText, rate);
  };

  const repeatSingleSentence = () => {
    if (!sentenceList.length) {
      speakAudio(audioText, listenRate);
      return;
    }

    const index = sentenceCursor % sentenceList.length;
    speakAudio(sentenceList[index], listenRate);
    setSentenceCursor((prev) => (prev + 1) % sentenceList.length);
  };

  const goPrev = () => {
    if (questionIndex === 0) return;
    setFeedback('');
    setQuestionIndex((v) => v - 1);
  };

  const goNext = () => {
    if (questionIndex >= totalCount - 1) return;
    setFeedback('');
    setQuestionIndex((v) => v + 1);
  };

  const undoLastSubmit = () => {
    if (!undoSnapshot) return;

    const state = loadState();
    const session = state.activeSession;
    if (!session) return;

    const answerIndex = session.answers.findIndex((item) => item.questionId === undoSnapshot.questionId);
    if (undoSnapshot.previousAnswer) {
      if (answerIndex >= 0) session.answers[answerIndex] = undoSnapshot.previousAnswer;
      else session.answers.push(undoSnapshot.previousAnswer);
    } else if (answerIndex >= 0) {
      session.answers.splice(answerIndex, 1);
    }

    session.score = undoSnapshot.previousScore;
    session.accuracy = undoSnapshot.previousAccuracy;
    session.currentQuestionIndex = undoSnapshot.previousSessionIndex;
    session.questionTotal = undoSnapshot.previousFlow.length;
    session.mode = mode;
    session.train = train;

    const wrongIndex = state.wrongBook.findIndex((item) => item.questionId === undoSnapshot.questionId);
    if (undoSnapshot.previousWrongItem) {
      if (wrongIndex >= 0) state.wrongBook[wrongIndex] = undoSnapshot.previousWrongItem;
      else state.wrongBook.push(undoSnapshot.previousWrongItem);
    } else if (wrongIndex >= 0) {
      state.wrongBook.splice(wrongIndex, 1);
    }

    state.reviewTasks = cloneReviewTasks(undoSnapshot.previousReviewTasks);
    state.activeSession = session;
    saveState(state);

    setQuestionFlow(undoSnapshot.previousFlow);
    setQuestionIndex(undoSnapshot.questionIndex);
    setSelected(undoSnapshot.selected);
    setStreak(undoSnapshot.previousStreak);
    setFeedback('已撤销上一次提交，可重新作答。');
    setUndoSnapshot(null);
  };

  const submit = () => {
    if (isChoiceQuestion && selected === null) return;

    const state = loadState();
    const hasCompatibleSession =
      Boolean(state.activeSession) &&
      state.activeSession?.mode === mode &&
      state.activeSession?.train === train &&
      state.activeSession.answers.every((answer) => questionById.has(answer.questionId));

    const session = hasCompatibleSession && state.activeSession ? state.activeSession : createSession();
    const selectedIndex = isChoiceQuestion ? (selected ?? 0) : 0;
    const isCorrect = isChoiceQuestion ? selectedIndex === question.answerIndex : true;

    const answerPayload: SessionAnswer = {
      questionId: question.id,
      selectedIndex,
      isCorrect,
      answeredAt: new Date().toISOString(),
    };

    const answerIndex = session.answers.findIndex((a) => a.questionId === question.id);
    const previousAnswer = answerIndex >= 0 ? { ...session.answers[answerIndex] } : null;

    const wrongIndex = state.wrongBook.findIndex((item) => item.questionId === question.id);
    const previousWrongItem = wrongIndex >= 0 ? { ...state.wrongBook[wrongIndex] } : null;

    if (answerIndex >= 0) session.answers[answerIndex] = answerPayload;
    else session.answers.push(answerPayload);

    const previousSessionIndex = session.currentQuestionIndex;
    const previousScore = session.score;
    const previousAccuracy = session.accuracy;
    const previousFlow = [...questionFlow];
    const previousStreak = streak;
    const previousReviewTasks = cloneReviewTasks(state.reviewTasks);

    session.score = session.answers.filter((a) => a.isCorrect).length;
    session.accuracy = totalCount > 0 ? session.score / totalCount : 0;
    session.questionTotal = totalCount;
    session.mode = mode;
    session.train = train;

    let nextFeedback = '';
    let nextFlow = questionFlow;

    if (isChoiceQuestion && !isCorrect) {
      const now = new Date();
      if (wrongIndex >= 0) {
        state.wrongBook[wrongIndex].wrongCount += 1;
        state.wrongBook[wrongIndex].lastWrongAt = now.toISOString();
        state.wrongBook[wrongIndex].mastered = false;
      } else {
        state.wrongBook.push({
          questionId: question.id,
          wrongCount: 1,
          lastWrongAt: now.toISOString(),
          mastered: false,
        });
      }

      state.reviewTasks = scheduleReviewTasks(state.reviewTasks, question.id, now);
      setStreak(0);

      nextFeedback = `答错了，正确答案是 ${String.fromCharCode(65 + question.answerIndex)}。`;

      const reinforcementId = pickReinforcementQuestionId(question, questionFlow, questionIndex, questionById);
      if (reinforcementId !== null) {
        const reorderedFlow = moveFutureQuestionToNext(questionFlow, questionIndex, reinforcementId);
        if (reorderedFlow !== questionFlow) {
          nextFlow = reorderedFlow;
          setQuestionFlow(reorderedFlow);
          nextFeedback += ' 已为你切换到相似题继续练习。';
        }
      }
    } else {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      nextFeedback = nextStreak >= 3 ? `连续答对 ${nextStreak} 题，真棒！` : '回答正确。';
    }

    const nextIndex = Math.min(questionIndex + 1, Math.max(nextFlow.length - 1, 0));
    session.currentQuestionIndex = Math.max(session.currentQuestionIndex, nextIndex);

    if (questionIndex >= nextFlow.length - 1) {
      session.finishedAt = new Date().toISOString();
      state.activeSession = null;
      state.sessions = [session, ...state.sessions].slice(0, 30);
      saveState(state);
      navigate('/result');
      return;
    }

    state.activeSession = session;
    saveState(state);

    setUndoSnapshot({
      questionId: question.id,
      questionIndex,
      selected,
      previousAnswer,
      previousWrongItem,
      previousSessionIndex,
      previousScore,
      previousAccuracy,
      previousStreak,
      previousFlow,
      previousReviewTasks,
    });

    setFeedback(nextFeedback);
    setQuestionIndex(nextIndex);
  };

  const modeTitle = mode === 'vocab' ? '词汇' : mode === 'dialogue' ? '对话' : '全部';
  const trainTitleMap: Record<string, string> = {
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
    daily20: '每日20题',
    today10: '今日10分钟',
    level10: '等级10题',
    spaced: '间隔复习',
  };

  return (
    <main className="page">
      <h1>
        练习 - {modeTitle} - {trainTitleMap[train] || '标准'}
      </h1>
      <ProgressBar current={questionIndex + 1} total={totalCount} />
      <Card
        title={train === 'audio' ? '先点击播放，再作答' : question.prompt}
        subtitle={train === 'audio' ? '听音后选择正确选项' : question.stem}
      >
        <div className="listen-controls">
          <Button variant="ghost" onClick={() => playFullAudio(1)}>
            正常
          </Button>
          <Button variant="ghost" onClick={() => playFullAudio(0.75)}>
            慢速
          </Button>
          <Button variant="ghost" onClick={repeatSingleSentence}>
            逐句重复
          </Button>
        </div>

        {isChoiceQuestion ? (
          <div className="options">
            {question.options.map((op, idx) => (
              <button
                key={`${question.id}-${op}`}
                className={`option ${selected === idx ? 'option-selected' : ''}`}
                onClick={() => setSelected(idx)}
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

        {feedback ? <p className="feedback">{feedback}</p> : null}

        {undoSnapshot ? (
          <Button variant="secondary" fullWidth onClick={undoLastSubmit}>
            撤销上次提交（仅一次）
          </Button>
        ) : null}

        <div className="actions-row">
          <Button variant="secondary" onClick={goPrev} disabled={questionIndex === 0}>
            上一题
          </Button>
          <Button variant="secondary" onClick={goNext} disabled={questionIndex >= totalCount - 1}>
            下一题
          </Button>
        </div>

        <Button onClick={submit} disabled={isChoiceQuestion && selected === null} fullWidth>
          {isChoiceQuestion ? '提交' : '我会了，下一题'}
        </Button>
      </Card>
    </main>
  );
}


