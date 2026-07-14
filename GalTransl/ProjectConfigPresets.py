from __future__ import annotations

from typing import Any

from GalTransl.DefaultProjectConfig import DEFAULT_PROJECT_CONFIG_YAML


ORIGINAL_PROJECT_CONFIG_PRESET_ID = "original"
JPEN_PROJECT_CONFIG_PRESET_ID = "jpen"


JPEN_VN_PROJECT_CONFIG_YAML = """# Translation backend settings
backendSpecific:
  OpenAI-Compatible: # OpenAI-compatible backends for ForGal/ForNovel translators
    tokens:
      - token: sk-example-key1
        endpoint: https://api.deepseek.com
        modelName: deepseek-chat
      - token: sk-example-key2
        endpoint: https://openrouter.ai/api/v1/chat/completions
        modelName: deepseek/deepseek-chat-v3-0324:free
        stream: true
    tokenStrategy: "random"
    checkAvailable: true
    checkAvailableConcurrency: 4
    globalRequestRPM: 0
    stream: true
    apiTimeout: 300
    apiErrorWait: auto

  SakuraLLM:
    endpoints:
      - http://127.0.0.1:8080
    rewriteModelName: ""

plugin:
  filePlugin: file_galtransl_json
  textPlugins:
    - text_common_normalfix
    #- text_common_skipNoJP
  file_galtransl_json:
    output_with_src: False

common:
  gpt.numPerRequestTranslate: 16
  gpt.dynamicNumPerRequestTranslate: false
  gpt.dynamicNumPerRequestTranslate.min: 8
  gpt.dynamicNumPerRequestTranslate.max: 64
  workersPerProject: 16
  autoAdjustWorkers: false
  sortBy: "size"
  language: "en"

  splitFile: "Num"
  splitFileNum: 2048
  splitFileCrossNum: 0

  save_steps: 1
  start_time: ""
  linebreakSymbol: "auto"
  skipH: false
  smartRetry: True
  retranslFail: false
  retranslKey:
    #- "(Failed)"
    #- "残留日文"

  gpt.contextNum: 8
  gpt.translation_guideline: "VN_JP-EN.md"
  gpt.enhance_jailbreak: False
  gpt.change_prompt: "no"
  gpt.prompt_content: ""
  gpt.token_limit: 0
  loggingLevel: info
  saveLog: false

proxy:
  enableProxy: false
  proxies:
    - address: http://127.0.0.1:7890

problemAnalyze:
  problemList:
    - 词频过高
    - 标点错漏
    - 残留日文
    #- 丢失换行
    - 多加换行
    - 比日文长
    - 字典使用
    - 缺控制符
    #- 比日文长严格

dictionary:
  defaultDictFolder: Dict
  usePreDictInName: false
  usePostDictInName: false
  useGPTDictInName: true
  sortDict: true
  preDict:
    - (project_dir)project_pre_dict.txt
  gpt.dict:
    - (project_dir)project_gpt_dictionary.txt
  postDict:
    - (project_dir)project_post_dict.txt
"""


_PROJECT_CONFIG_PRESETS: dict[str, dict[str, Any]] = {
    ORIGINAL_PROJECT_CONFIG_PRESET_ID: {
        "id": ORIGINAL_PROJECT_CONFIG_PRESET_ID,
        "name": "Original GalTransl JP->ZH",
        "description": "Original GalTransl Japanese-to-Chinese project template.",
        "content": DEFAULT_PROJECT_CONFIG_YAML,
    },
    JPEN_PROJECT_CONFIG_PRESET_ID: {
        "id": JPEN_PROJECT_CONFIG_PRESET_ID,
        "name": "JP->EN Visual Novel Localization",
        "description": "Japanese-to-English visual novel localization template using OpenAI-compatible translators.",
        "content": JPEN_VN_PROJECT_CONFIG_YAML,
    },
}


def normalize_project_config_preset_id(preset_id: str | None) -> str:
    normalized = (preset_id or ORIGINAL_PROJECT_CONFIG_PRESET_ID).strip().lower()
    aliases = {
        "": ORIGINAL_PROJECT_CONFIG_PRESET_ID,
        "default": ORIGINAL_PROJECT_CONFIG_PRESET_ID,
        "jpzh": ORIGINAL_PROJECT_CONFIG_PRESET_ID,
        "jp-zh": ORIGINAL_PROJECT_CONFIG_PRESET_ID,
        "original-jpzh": ORIGINAL_PROJECT_CONFIG_PRESET_ID,
        "jp-en": JPEN_PROJECT_CONFIG_PRESET_ID,
        "jpen-vn": JPEN_PROJECT_CONFIG_PRESET_ID,
    }
    return aliases.get(normalized, normalized)


def get_project_config_preset(preset_id: str | None) -> dict[str, Any] | None:
    return _PROJECT_CONFIG_PRESETS.get(normalize_project_config_preset_id(preset_id))


def list_project_config_presets() -> list[dict[str, str]]:
    return [
        {
            "id": str(preset["id"]),
            "name": str(preset["name"]),
            "description": str(preset["description"]),
        }
        for preset in _PROJECT_CONFIG_PRESETS.values()
    ]
