/** Plain-language messages for the errors starting audio can throw. */

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    "Microphone access was blocked. Allow it in your browser's site settings, then try again.",
  NotFoundError: "No microphone or audio input was found.",
  NotReadableError:
    "The microphone is busy or unavailable. Close other apps that use it, then try again.",
  NotSupportedError:
    "The microphone only works on a secure page (https or localhost).",
};

/** Explains why the mic or audio couldn't start, in words a player can act on. */
export function describeAudioError(error: unknown) {
  if (error instanceof DOMException && error.name in ERROR_MESSAGES) {
    return ERROR_MESSAGES[error.name];
  }
  return error instanceof Error
    ? `Couldn't start listening: ${error.message}`
    : "Couldn't start listening.";
}
