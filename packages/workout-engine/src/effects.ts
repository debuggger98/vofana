export type WorkoutEffect =
    | {
          type: "START_REST_TIMER";
          durationSeconds: number;
      }
    | {
          type: "STOP_REST_TIMER";
      }
    | {
          type: "ANNOUNCE";
          message: string;
      };
