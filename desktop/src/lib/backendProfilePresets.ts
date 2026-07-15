import type { TranslationKey } from '../i18n';

export type BackendProfilePresetId =
  | 'blank'
  | 'lm-studio-local'
  | 'llama-cpp-local'
  | 'koboldcpp-local'
  | 'openrouter'
  | 'gemini-openai-compatible'
  | 'generic-openai-compatible';

export type BackendProfilePreset = {
  id: BackendProfilePresetId;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  suggestedProfileName: string;
  profile: Record<string, unknown>;
};

function openAiCompatibleProfile({
  endpoint,
  modelName,
  stream,
  token,
}: {
  endpoint: string;
  modelName: string;
  stream: boolean;
  token: string;
}): Record<string, unknown> {
  return {
    'OpenAI-Compatible': {
      tokens: [
        {
          token,
          endpoint,
          modelName,
          stream,
        },
      ],
      tokenStrategy: 'fallback',
      checkAvailable: true,
      checkAvailableConcurrency: 1,
      globalRequestRPM: 0,
      stream,
      apiTimeout: 300,
      apiErrorWait: 'auto',
    },
    proxy: {
      enableProxy: false,
      proxies: [],
    },
  };
}

export const BACKEND_PROFILE_PRESETS: BackendProfilePreset[] = [
  {
    id: 'blank',
    labelKey: 'backendProfiles.preset.blank',
    descriptionKey: 'backendProfiles.preset.blankDescription',
    suggestedProfileName: '',
    profile: {},
  },
  {
    id: 'lm-studio-local',
    labelKey: 'backendProfiles.preset.lmStudio',
    descriptionKey: 'backendProfiles.preset.lmStudioDescription',
    suggestedProfileName: 'LM Studio Local',
    profile: openAiCompatibleProfile({
      endpoint: 'http://127.0.0.1:1234/v1',
      modelName: 'local-model',
      stream: true,
      token: 'sk-local',
    }),
  },
  {
    id: 'llama-cpp-local',
    labelKey: 'backendProfiles.preset.llamaCpp',
    descriptionKey: 'backendProfiles.preset.llamaCppDescription',
    suggestedProfileName: 'llama.cpp Local',
    profile: openAiCompatibleProfile({
      endpoint: 'http://127.0.0.1:8080/v1',
      modelName: 'local-model',
      stream: true,
      token: 'sk-local',
    }),
  },
  {
    id: 'koboldcpp-local',
    labelKey: 'backendProfiles.preset.koboldCpp',
    descriptionKey: 'backendProfiles.preset.koboldCppDescription',
    suggestedProfileName: 'KoboldCpp Local',
    profile: openAiCompatibleProfile({
      endpoint: 'http://127.0.0.1:5001/v1',
      modelName: 'local-model',
      stream: false,
      token: 'sk-local',
    }),
  },
  {
    id: 'openrouter',
    labelKey: 'backendProfiles.preset.openRouter',
    descriptionKey: 'backendProfiles.preset.openRouterDescription',
    suggestedProfileName: 'OpenRouter',
    profile: openAiCompatibleProfile({
      endpoint: 'https://openrouter.ai/api/v1',
      modelName: 'provider/model-id',
      stream: true,
      token: 'sk-or-v1-your-key',
    }),
  },
  {
    id: 'gemini-openai-compatible',
    labelKey: 'backendProfiles.preset.gemini',
    descriptionKey: 'backendProfiles.preset.geminiDescription',
    suggestedProfileName: 'Gemini OpenAI-Compatible',
    profile: openAiCompatibleProfile({
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      modelName: 'gemini-model-id',
      stream: true,
      token: 'GEMINI_API_KEY',
    }),
  },
  {
    id: 'generic-openai-compatible',
    labelKey: 'backendProfiles.preset.generic',
    descriptionKey: 'backendProfiles.preset.genericDescription',
    suggestedProfileName: 'Generic OpenAI-Compatible',
    profile: openAiCompatibleProfile({
      endpoint: 'https://api.example.com/v1',
      modelName: 'your-model-id',
      stream: true,
      token: 'sk-your-api-key',
    }),
  },
];

export function cloneBackendProfilePresetProfile(preset: BackendProfilePreset): Record<string, unknown> {
  return JSON.parse(JSON.stringify(preset.profile)) as Record<string, unknown>;
}

export function getBackendProfilePreset(id: BackendProfilePresetId): BackendProfilePreset {
  return BACKEND_PROFILE_PRESETS.find((preset) => preset.id === id) ?? BACKEND_PROFILE_PRESETS[0];
}
