import {
  AutomaticSpeechRecognitionPipeline,
  env,
  pipeline,
} from "@huggingface/transformers";

import {
  AlignmentCue,
  SpeechChunk,
  alignSpeech,
  hasSpeechActivity,
} from "./alignment";

env.allowLocalModels = false;
let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | undefined;
globalThis.onmessage = async (
  event: MessageEvent<{
    pcm: Float32Array;
    sampleRate: number;
    startTime: number;
    cues: AlignmentCue[];
  }>,
) => {
  try {
    const { pcm, sampleRate, startTime, cues } = event.data;
    if (!hasSpeechActivity(pcm, sampleRate))
      throw new Error(
        "Not enough distinct dialogue was heard. Try a scene with clear speech.",
      );
    globalThis.postMessage({ status: "model", progress: 0 });
    recognizer ??= (
      pipeline as (
        task: "automatic-speech-recognition",
        model: string,
        options: {
          dtype: "q8";
          progress_callback: (value: {
            status: string;
            progress?: number;
          }) => void;
        },
      ) => Promise<AutomaticSpeechRecognitionPipeline>
    )("automatic-speech-recognition", "Xenova/whisper-tiny", {
      dtype: "q8",
      progress_callback: (value: { status: string; progress?: number }) => {
        if (value.progress !== undefined)
          globalThis.postMessage({
            status: "model",
            progress: Math.round(value.progress),
          });
      },
    });
    const asr = await recognizer;
    globalThis.postMessage({ status: "analysing" });
    const ratio = sampleRate / 16000;
    const mono = new Float32Array(Math.floor(pcm.length / ratio));
    for (let i = 0; i < mono.length; i += 1) {
      const source = i * ratio;
      const lower = Math.floor(source);
      const fraction = source - lower;
      mono[i] =
        pcm[lower] * (1 - fraction) +
        pcm[Math.min(pcm.length - 1, lower + 1)] * fraction;
    }
    const result = await asr(mono, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const output = Array.isArray(result) ? result[0] : result;
    const alignment = alignSpeech(
      (output.chunks ?? []) as SpeechChunk[],
      cues,
      startTime,
    );
    if (!alignment)
      throw new Error(
        "The dialogue did not match this track confidently enough. Its delay was left unchanged.",
      );
    globalThis.postMessage({ status: "complete", alignment });
  } catch (error) {
    globalThis.postMessage({
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "Subtitle synchronisation failed.",
    });
  }
};
