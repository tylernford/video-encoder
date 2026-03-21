import { useEffect, useRef, useState } from "react";

type EncodingOutput = {
  suffix: string;
  codec: string;
  status: string;
  progress: number;
};

type EncodingState = {
  status: "connecting" | "encoding" | "done" | "error";
  progress: number;
  outputs: EncodingOutput[];
  error: string | null;
};

const INITIAL_STATE: EncodingState = {
  status: "connecting",
  progress: 0,
  outputs: [],
  error: null,
};

export function useEncodingProgress(jobId: string | null): EncodingState {
  const [state, setState] = useState<EncodingState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setState(INITIAL_STATE);
      return;
    }

    setState(INITIAL_STATE);

    const es = new EventSource(`/api/encode/${jobId}/progress`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        status: string;
        progress: number;
        outputs: EncodingOutput[];
      };

      setState({
        status: data.status as EncodingState["status"],
        progress: data.progress,
        outputs: data.outputs,
        error: null,
      });

      if (data.status === "done" || data.status === "error") {
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Lost connection to server",
      }));
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [jobId]);

  return state;
}

export type { EncodingState, EncodingOutput };
