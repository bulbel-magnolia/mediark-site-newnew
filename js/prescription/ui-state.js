const state = {
  currentStep: 1,
  currentLang: localStorage.getItem("mediark_lang") || "zh",
  activePatient: null,
  generatedBundle: null,
  doctorReviewNote: "",
  isGenerating: false
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
  return state;
}

export function resetWorkflow() {
  state.currentStep = 1;
  state.generatedBundle = null;
  state.doctorReviewNote = "";
  state.isGenerating = false;
  listeners.forEach((listener) => listener(state));
}
