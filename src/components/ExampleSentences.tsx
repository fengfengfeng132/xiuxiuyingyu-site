import { useEffect, useRef, useState } from 'react';
import type { ExampleSentence } from '../data/dictationWords';
import { playLocalExampleAudio, stopUsWordAudioPlayback } from '../lib/phonetic';
import { Button } from './Button';

interface ExampleSentencesProps {
  examples?: ExampleSentence[];
  revealed: boolean;
  beforePlay?: () => void;
}

export function ExampleSentences({ examples, revealed, beforePlay }: ExampleSentencesProps) {
  const [englishHidden, setEnglishHidden] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const audioRequestRef = useRef(0);
  const playedExampleRef = useRef(false);

  useEffect(() => () => {
    audioRequestRef.current += 1;
    if (playedExampleRef.current) stopUsWordAudioPlayback();
  }, []);

  if (!revealed || !examples?.length) return null;

  const playExample = async (audioKey: string, rate: number) => {
    const requestId = ++audioRequestRef.current;
    playedExampleRef.current = true;
    beforePlay?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setAudioMessage('');
    const result = await playLocalExampleAudio(audioKey, rate);
    if (requestId !== audioRequestRef.current || result.ok || result.reason === 'stale') return;
    setAudioMessage(result.reason === 'missing' ? '这条例句的音频还未准备好。' : '例句播放失败，请再点一次。');
  };

  return (
    <div className="example-sentences" aria-label="例句学习">
      <div className="example-sentences-heading">
        <h2>读一读，背例句</h2>
        <Button variant="ghost" type="button" aria-pressed={englishHidden} onClick={() => setEnglishHidden((hidden) => !hidden)}>
          {englishHidden ? '显示英文' : '遮住英文'}
        </Button>
      </div>
      <p className="example-sentences-guide">先听读，再遮住英文，看着中文试着背。</p>
      {examples.map((example) => (
        <div className="example-sentence" key={example.audioKey}>
          {example.source ? <span className="example-sentence-source">{example.source}</span> : null}
          {englishHidden ? <p className="example-sentence-covered">试着说出英文，再点“显示英文”核对。</p> : <p className="example-sentence-english" lang="en">{example.text}</p>}
          <p className="example-sentence-translation">{example.translation}</p>
          <div className="example-sentence-actions">
            <Button variant="secondary" type="button" onClick={() => void playExample(example.audioKey, 1)}>听例句</Button>
            <Button variant="ghost" type="button" onClick={() => void playExample(example.audioKey, 0.75)}>慢速听</Button>
          </div>
        </div>
      ))}
      {audioMessage ? <p className="example-sentence-audio-message" role="status">{audioMessage}</p> : null}
    </div>
  );
}
