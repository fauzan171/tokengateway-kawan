# Baseline inventory Open WebUI

Commit `f8ae8a6c328946dc62cd0712961a0632574581bf`. Metadata hasil scan, bukan source code aplikasi. Seluruh row masuk target planning; status perilaku belum diverifikasi.


## Persistent config keys

Default reference adalah metadata simbol, bukan nilai env yang sudah dievaluasi. Semua key wajib dipetakan ke control/API/operation; secrets memakai extension encrypted.

| ID | Key | Default reference | Owner |
|---|---|---|---|
| CFG-001 | direct.enable | ENABLE_DIRECT_CONNECTIONS | P04 |
| CFG-002 | direct.integrations.enable | ENABLE_DIRECT_INTEGRATIONS | P04 |
| CFG-003 | ollama.enable | ENABLE_OLLAMA_API | P04 |
| CFG-004 | ollama.base_urls | OLLAMA_BASE_URLS | P04 |
| CFG-005 | ollama.api_configs | OLLAMA_API_CONFIGS | P04 |
| CFG-006 | openai.enable | ENABLE_OPENAI_API | P04 |
| CFG-007 | openai.api_keys | OPENAI_API_KEYS | P04 |
| CFG-008 | openai.api_base_urls | OPENAI_API_BASE_URLS | P04 |
| CFG-009 | openai.api_configs | OPENAI_API_CONFIGS | P04 |
| CFG-010 | models.base_models_cache | ENABLE_BASE_MODELS_CACHE | P10 |
| CFG-011 | tool_server.connections | TOOL_SERVER_CONNECTIONS | P12 |
| CFG-012 | oauth.client.timeout | OAUTH_CLIENT_TIMEOUT | P02 |
| CFG-013 | terminal_server.connections | TERMINAL_SERVER_CONNECTIONS | P21 |
| CFG-014 | code_execution.enable | ENABLE_CODE_EXECUTION | P21 |
| CFG-015 | code_execution.engine | CODE_EXECUTION_ENGINE | P21 |
| CFG-016 | code_execution.jupyter.url | CODE_EXECUTION_JUPYTER_URL | P21 |
| CFG-017 | code_execution.jupyter.auth | CODE_EXECUTION_JUPYTER_AUTH | P02 |
| CFG-018 | code_execution.jupyter.auth_token | CODE_EXECUTION_JUPYTER_AUTH_TOKEN | P02 |
| CFG-019 | code_execution.jupyter.auth_password | CODE_EXECUTION_JUPYTER_AUTH_PASSWORD | P02 |
| CFG-020 | code_execution.jupyter.timeout | CODE_EXECUTION_JUPYTER_TIMEOUT | P21 |
| CFG-021 | code_interpreter.enable | ENABLE_CODE_INTERPRETER | P21 |
| CFG-022 | memories.enable | ENABLE_MEMORIES | P14 |
| CFG-023 | memories.system_context.enable | ENABLE_MEMORY_SYSTEM_CONTEXT | P14 |
| CFG-024 | memories.background_review.enable | ENABLE_MEMORY_BACKGROUND_REVIEW | P14 |
| CFG-025 | memories.review_interval_turns | MEMORIES_REVIEW_INTERVAL_TURNS | P14 |
| CFG-026 | memories.user_char_limit | MEMORIES_USER_CHAR_LIMIT | P14 |
| CFG-027 | memories.context_char_limit | MEMORIES_CONTEXT_CHAR_LIMIT | P14 |
| CFG-028 | code_interpreter.engine | CODE_INTERPRETER_ENGINE | P21 |
| CFG-029 | code_interpreter.prompt_template | CODE_INTERPRETER_PROMPT_TEMPLATE | P21 |
| CFG-030 | code_interpreter.jupyter.url | CODE_INTERPRETER_JUPYTER_URL | P21 |
| CFG-031 | code_interpreter.jupyter.auth | CODE_INTERPRETER_JUPYTER_AUTH | P02 |
| CFG-032 | code_interpreter.jupyter.auth_token | CODE_INTERPRETER_JUPYTER_AUTH_TOKEN | P02 |
| CFG-033 | code_interpreter.jupyter.auth_password | CODE_INTERPRETER_JUPYTER_AUTH_PASSWORD | P02 |
| CFG-034 | code_interpreter.jupyter.timeout | CODE_INTERPRETER_JUPYTER_TIMEOUT | P21 |
| CFG-035 | google_drive.enable | ENABLE_GOOGLE_DRIVE_INTEGRATION | P23 |
| CFG-036 | google_drive.client_id | GOOGLE_DRIVE_CLIENT_ID | P23 |
| CFG-037 | google_drive.api_key | GOOGLE_DRIVE_API_KEY | P23 |
| CFG-038 | onedrive.enable | ENABLE_ONEDRIVE_INTEGRATION | P23 |
| CFG-039 | onedrive.sharepoint_url | ONEDRIVE_SHAREPOINT_URL | P06 |
| CFG-040 | onedrive.sharepoint_tenant_id | ONEDRIVE_SHAREPOINT_TENANT_ID | P06 |
| CFG-041 | rag.content_extraction_engine | CONTENT_EXTRACTION_ENGINE | P13 |
| CFG-042 | rag.content_extraction.supported_media_mime_types | CONTENT_EXTRACTION_SUPPORTED_MEDIA_MIME_TYPES | P13 |
| CFG-043 | rag.datalab_marker_api_key | DATALAB_MARKER_API_KEY | P13 |
| CFG-044 | rag.datalab_marker_api_base_url | DATALAB_MARKER_API_BASE_URL | P13 |
| CFG-045 | rag.datalab_marker_additional_config | DATALAB_MARKER_ADDITIONAL_CONFIG | P13 |
| CFG-046 | rag.datalab_marker_use_llm | DATALAB_MARKER_USE_LLM | P13 |
| CFG-047 | rag.datalab_marker_skip_cache | DATALAB_MARKER_SKIP_CACHE | P13 |
| CFG-048 | rag.datalab_marker_force_ocr | DATALAB_MARKER_FORCE_OCR | P13 |
| CFG-049 | rag.datalab_marker_paginate | DATALAB_MARKER_PAGINATE | P13 |
| CFG-050 | rag.datalab_marker_strip_existing_ocr | DATALAB_MARKER_STRIP_EXISTING_OCR | P13 |
| CFG-051 | rag.datalab_marker_disable_image_extraction | DATALAB_MARKER_DISABLE_IMAGE_EXTRACTION | P13 |
| CFG-052 | rag.datalab_marker_format_lines | DATALAB_MARKER_FORMAT_LINES | P13 |
| CFG-053 | rag.datalab_marker_output_format | DATALAB_MARKER_OUTPUT_FORMAT | P13 |
| CFG-054 | rag.mineru_api_mode | MINERU_API_MODE | P13 |
| CFG-055 | rag.mineru_api_url | MINERU_API_URL | P13 |
| CFG-056 | rag.mineru_api_timeout | MINERU_API_TIMEOUT | P13 |
| CFG-057 | rag.mineru_api_key | MINERU_API_KEY | P13 |
| CFG-058 | rag.mineru_params | MINERU_PARAMS | P13 |
| CFG-059 | rag.mineru_file_extensions | MINERU_FILE_EXTENSIONS | P13 |
| CFG-060 | rag.external_document_loader_url | EXTERNAL_DOCUMENT_LOADER_URL | P13 |
| CFG-061 | rag.external_document_loader_api_key | EXTERNAL_DOCUMENT_LOADER_API_KEY | P13 |
| CFG-062 | rag.external_document_loader_headers | EXTERNAL_DOCUMENT_LOADER_HEADERS | P13 |
| CFG-063 | rag.tika_server_url | TIKA_SERVER_URL | P13 |
| CFG-064 | rag.tika_server_version | TIKA_SERVER_VERSION | P13 |
| CFG-065 | rag.docling_server_url | DOCLING_SERVER_URL | P13 |
| CFG-066 | rag.docling_api_key | DOCLING_API_KEY | P13 |
| CFG-067 | rag.docling_params | DOCLING_PARAMS | P13 |
| CFG-068 | rag.document_intelligence_endpoint | DOCUMENT_INTELLIGENCE_ENDPOINT | P13 |
| CFG-069 | rag.document_intelligence_key | DOCUMENT_INTELLIGENCE_KEY | P13 |
| CFG-070 | rag.document_intelligence_model | DOCUMENT_INTELLIGENCE_MODEL | P13 |
| CFG-071 | rag.mistral_ocr_api_base_url | MISTRAL_OCR_API_BASE_URL | P13 |
| CFG-072 | rag.mistral_ocr_api_key | MISTRAL_OCR_API_KEY | P13 |
| CFG-073 | rag.mistral_ocr_use_base64 | MISTRAL_OCR_USE_BASE64 | P13 |
| CFG-074 | rag.paddleocr_vl_base_url | PADDLEOCR_VL_BASE_URL | P13 |
| CFG-075 | rag.paddleocr_vl_token | PADDLEOCR_VL_TOKEN | P13 |
| CFG-076 | rag.bypass_embedding_and_retrieval | BYPASS_EMBEDDING_AND_RETRIEVAL | P13 |
| CFG-077 | rag.top_k | RAG_TOP_K | P13 |
| CFG-078 | rag.top_k_reranker | RAG_TOP_K_RERANKER | P13 |
| CFG-079 | rag.relevance_threshold | RAG_RELEVANCE_THRESHOLD | P13 |
| CFG-080 | rag.hybrid_bm25_weight | RAG_HYBRID_BM25_WEIGHT | P13 |
| CFG-081 | rag.enable_hybrid_search | ENABLE_RAG_HYBRID_SEARCH | P13 |
| CFG-082 | rag.enable_hybrid_search_enriched_texts | ENABLE_RAG_HYBRID_SEARCH_ENRICHED_TEXTS | P13 |
| CFG-083 | rag.full_context | RAG_FULL_CONTEXT | P13 |
| CFG-084 | rag.file.max_count | RAG_FILE_MAX_COUNT | P13 |
| CFG-085 | rag.file.max_size | RAG_FILE_MAX_SIZE | P13 |
| CFG-086 | file.image_compression_width | FILE_IMAGE_COMPRESSION_WIDTH | P16 |
| CFG-087 | file.image_compression_height | FILE_IMAGE_COMPRESSION_HEIGHT | P16 |
| CFG-088 | rag.file.allowed_extensions | RAG_ALLOWED_FILE_EXTENSIONS | P13 |
| CFG-089 | rag.embedding_engine | RAG_EMBEDDING_ENGINE | P13 |
| CFG-090 | rag.pdf_extract_images | PDF_EXTRACT_IMAGES | P13 |
| CFG-091 | rag.pdf_loader_mode | PDF_LOADER_MODE | P13 |
| CFG-092 | rag.embedding_model | RAG_EMBEDDING_MODEL | P13 |
| CFG-093 | rag.tokenizer_model | RAG_TOKENIZER_MODEL | P13 |
| CFG-094 | rag.embedding_batch_size | RAG_EMBEDDING_BATCH_SIZE | P13 |
| CFG-095 | rag.enable_async_embedding | ENABLE_ASYNC_EMBEDDING | P13 |
| CFG-096 | rag.embedding_concurrent_requests | RAG_EMBEDDING_CONCURRENT_REQUESTS | P13 |
| CFG-097 | rag.reranking_engine | RAG_RERANKING_ENGINE | P13 |
| CFG-098 | rag.reranking_model | RAG_RERANKING_MODEL | P13 |
| CFG-099 | rag.reranking_batch_size | RAG_RERANKING_BATCH_SIZE | P13 |
| CFG-100 | rag.external_reranker_url | RAG_EXTERNAL_RERANKER_URL | P13 |
| CFG-101 | rag.external_reranker_api_key | RAG_EXTERNAL_RERANKER_API_KEY | P13 |
| CFG-102 | rag.external_reranker_timeout | RAG_EXTERNAL_RERANKER_TIMEOUT | P13 |
| CFG-103 | rag.text_splitter | RAG_TEXT_SPLITTER | P13 |
| CFG-104 | rag.enable_markdown_header_text_splitter | ENABLE_MARKDOWN_HEADER_TEXT_SPLITTER | P13 |
| CFG-105 | rag.tiktoken_encoding_name | TIKTOKEN_ENCODING_NAME | P13 |
| CFG-106 | rag.chunk_size | CHUNK_SIZE | P13 |
| CFG-107 | rag.chunk_min_size_target | CHUNK_MIN_SIZE_TARGET | P13 |
| CFG-108 | rag.chunk_overlap | CHUNK_OVERLAP | P13 |
| CFG-109 | rag.template | RAG_TEMPLATE | P13 |
| CFG-110 | rag.openai.api_base_url | RAG_OPENAI_API_BASE_URL | P04 |
| CFG-111 | rag.openai.api_key | RAG_OPENAI_API_KEY | P04 |
| CFG-112 | rag.azure_openai.base_url | RAG_AZURE_OPENAI_BASE_URL | P04 |
| CFG-113 | rag.azure_openai.api_key | RAG_AZURE_OPENAI_API_KEY | P04 |
| CFG-114 | rag.azure_openai.api_version | RAG_AZURE_OPENAI_API_VERSION | P04 |
| CFG-115 | rag.ollama.base_url | RAG_OLLAMA_BASE_URL | P04 |
| CFG-116 | rag.ollama.api_key | RAG_OLLAMA_API_KEY | P04 |
| CFG-117 | rag.youtube_loader_language | YOUTUBE_LOADER_LANGUAGE | P13 |
| CFG-118 | rag.youtube_loader_proxy_url | YOUTUBE_LOADER_PROXY_URL | P13 |
| CFG-119 | web.search.enable | ENABLE_WEB_SEARCH | P14 |
| CFG-120 | web.search.confirmation.enable | ENABLE_WEB_SEARCH_CONFIRMATION | P14 |
| CFG-121 | web.search.confirmation.content | WEB_SEARCH_CONFIRMATION_CONTENT | P14 |
| CFG-122 | web.search.engine | WEB_SEARCH_ENGINE | P14 |
| CFG-123 | web.search.bypass_embedding_and_retrieval | BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL | P14 |
| CFG-124 | web.search.bypass_web_loader | BYPASS_WEB_SEARCH_WEB_LOADER | P14 |
| CFG-125 | web.search.result_count | WEB_SEARCH_RESULT_COUNT | P14 |
| CFG-126 | web.search.domain.filter_list | WEB_SEARCH_DOMAIN_FILTER_LIST | P14 |
| CFG-127 | web.search.concurrent_requests | WEB_SEARCH_CONCURRENT_REQUESTS | P14 |
| CFG-128 | web.fetch.max_content_length | WEB_FETCH_MAX_CONTENT_LENGTH | P14 |
| CFG-129 | web.loader.engine | WEB_LOADER_ENGINE | P14 |
| CFG-130 | web.loader.concurrent_requests | WEB_LOADER_CONCURRENT_REQUESTS | P14 |
| CFG-131 | web.loader.timeout | WEB_LOADER_TIMEOUT | P14 |
| CFG-132 | web.loader.ssl_verification | ENABLE_WEB_LOADER_SSL_VERIFICATION | P14 |
| CFG-133 | web.search.trust_env | WEB_SEARCH_TRUST_ENV | P14 |
| CFG-134 | web.search.ollama_cloud_api_key | OLLAMA_CLOUD_WEB_SEARCH_API_KEY | P04 |
| CFG-135 | web.search.searxng_query_url | SEARXNG_QUERY_URL | P14 |
| CFG-136 | web.search.openserp_base_url | OPENSERP_BASE_URL | P14 |
| CFG-137 | web.search.searxng_language | SEARXNG_LANGUAGE | P14 |
| CFG-138 | web.search.yacy_query_url | YACY_QUERY_URL | P14 |
| CFG-139 | web.search.yacy_username | YACY_USERNAME | P14 |
| CFG-140 | web.search.yacy_password | YACY_PASSWORD | P14 |
| CFG-141 | web.search.google_pse_api_key | GOOGLE_PSE_API_KEY | P14 |
| CFG-142 | web.search.google_pse_engine_id | GOOGLE_PSE_ENGINE_ID | P14 |
| CFG-143 | web.search.brave_search_api_key | BRAVE_SEARCH_API_KEY | P14 |
| CFG-144 | web.search.brave_search_context_tokens | BRAVE_SEARCH_CONTEXT_TOKENS | P14 |
| CFG-145 | web.search.kagi_search_api_key | KAGI_SEARCH_API_KEY | P14 |
| CFG-146 | web.search.mojeek_search_api_key | MOJEEK_SEARCH_API_KEY | P14 |
| CFG-147 | web.search.bocha_search_api_key | BOCHA_SEARCH_API_KEY | P14 |
| CFG-148 | web.search.serpstack_api_key | SERPSTACK_API_KEY | P14 |
| CFG-149 | web.search.serpstack_https | SERPSTACK_HTTPS | P14 |
| CFG-150 | web.search.serper_api_key | SERPER_API_KEY | P14 |
| CFG-151 | web.search.serply_api_key | SERPLY_API_KEY | P14 |
| CFG-152 | web.search.serphouse_api_key | SERPHOUSE_API_KEY | P14 |
| CFG-153 | web.search.serphouse_domain | SERPHOUSE_DOMAIN | P14 |
| CFG-154 | web.search.ddgs_backend | DDGS_BACKEND | P14 |
| CFG-155 | web.search.jina_api_key | JINA_API_KEY | P14 |
| CFG-156 | web.search.jina_api_base_url | JINA_API_BASE_URL | P14 |
| CFG-157 | web.search.searchapi_api_key | SEARCHAPI_API_KEY | P14 |
| CFG-158 | web.search.searchapi_engine | SEARCHAPI_ENGINE | P14 |
| CFG-159 | web.search.serpapi_api_key | SERPAPI_API_KEY | P14 |
| CFG-160 | web.search.serpapi_engine | SERPAPI_ENGINE | P14 |
| CFG-161 | web.search.bing_search_v7_endpoint | BING_SEARCH_V7_ENDPOINT | P14 |
| CFG-162 | web.search.bing_search_v7_subscription_key | BING_SEARCH_V7_SUBSCRIPTION_KEY | P14 |
| CFG-163 | web.search.azure_ai_search_api_key | AZURE_AI_SEARCH_API_KEY | P14 |
| CFG-164 | web.search.azure_ai_search_endpoint | AZURE_AI_SEARCH_ENDPOINT | P14 |
| CFG-165 | web.search.azure_ai_search_index_name | AZURE_AI_SEARCH_INDEX_NAME | P14 |
| CFG-166 | web.search.exa_api_key | EXA_API_KEY | P14 |
| CFG-167 | web.search.exa_max_content_length | EXA_MAX_CONTENT_LENGTH | P14 |
| CFG-168 | web.search.perplexity_api_key | PERPLEXITY_API_KEY | P14 |
| CFG-169 | web.search.perplexity_model | PERPLEXITY_MODEL | P14 |
| CFG-170 | web.search.perplexity_search_context_usage | PERPLEXITY_SEARCH_CONTEXT_USAGE | P14 |
| CFG-171 | web.search.perplexity_search_api_url | PERPLEXITY_SEARCH_API_URL | P14 |
| CFG-172 | web.search.microsoft_web_iq_api_base_url | MICROSOFT_WEB_IQ_API_BASE_URL | P14 |
| CFG-173 | web.search.microsoft_web_iq_api_key | MICROSOFT_WEB_IQ_API_KEY | P14 |
| CFG-174 | web.search.microsoft_web_iq_language | MICROSOFT_WEB_IQ_LANGUAGE | P14 |
| CFG-175 | web.search.sougou_api_sid | SOUGOU_API_SID | P14 |
| CFG-176 | web.search.sougou_api_sk | SOUGOU_API_SK | P14 |
| CFG-177 | web.search.tavily_api_key | TAVILY_API_KEY | P14 |
| CFG-178 | web.search.tavily_extract_depth | TAVILY_EXTRACT_DEPTH | P14 |
| CFG-179 | web.search.tavily_search_depth | TAVILY_SEARCH_DEPTH | P14 |
| CFG-180 | web.search.staan_api_key | STAAN_API_KEY | P14 |
| CFG-181 | web.search.staan_market | STAAN_MARKET | P14 |
| CFG-182 | web.search.staan_max_snippets | STAAN_MAX_SNIPPETS | P14 |
| CFG-183 | web.loader.playwright_ws_url | PLAYWRIGHT_WS_URL | P14 |
| CFG-184 | web.loader.playwright_timeout | PLAYWRIGHT_TIMEOUT | P14 |
| CFG-185 | web.loader.firecrawl_api_key | FIRECRAWL_API_KEY | P14 |
| CFG-186 | web.loader.firecrawl_api_url | FIRECRAWL_API_BASE_URL | P14 |
| CFG-187 | web.loader.firecrawl_timeout | FIRECRAWL_TIMEOUT | P14 |
| CFG-188 | web.search.external_web_search_url | EXTERNAL_WEB_SEARCH_URL | P14 |
| CFG-189 | web.search.external_web_search_api_key | EXTERNAL_WEB_SEARCH_API_KEY | P14 |
| CFG-190 | web.loader.external_web_loader_url | EXTERNAL_WEB_LOADER_URL | P14 |
| CFG-191 | web.loader.external_web_loader_api_key | EXTERNAL_WEB_LOADER_API_KEY | P14 |
| CFG-192 | web.search.yandex_web_search_url | YANDEX_WEB_SEARCH_URL | P14 |
| CFG-193 | web.search.yandex_web_search_api_key | YANDEX_WEB_SEARCH_API_KEY | P14 |
| CFG-194 | web.search.yandex_web_search_config | YANDEX_WEB_SEARCH_CONFIG | P14 |
| CFG-195 | web.search.youcom_api_key | YOUCOM_API_KEY | P14 |
| CFG-196 | web.search.linkup_api_key | LINKUP_API_KEY | P14 |
| CFG-197 | web.search.linkup_search_params | LINKUP_SEARCH_PARAMS | P14 |
| CFG-198 | image_generation.enable | ENABLE_IMAGE_GENERATION | P16 |
| CFG-199 | image_generation.engine | IMAGE_GENERATION_ENGINE | P16 |
| CFG-200 | image_generation.model | IMAGE_GENERATION_MODEL | P16 |
| CFG-201 | image_generation.size | IMAGE_SIZE | P16 |
| CFG-202 | image_generation.steps | IMAGE_STEPS | P16 |
| CFG-203 | image_generation.prompt.enable | ENABLE_IMAGE_PROMPT_GENERATION | P16 |
| CFG-204 | image_generation.automatic1111.base_url | AUTOMATIC1111_BASE_URL | P16 |
| CFG-205 | image_generation.automatic1111.api_auth | AUTOMATIC1111_API_AUTH | P02 |
| CFG-206 | image_generation.automatic1111.api_params | AUTOMATIC1111_PARAMS | P16 |
| CFG-207 | image_generation.comfyui.base_url | COMFYUI_BASE_URL | P16 |
| CFG-208 | image_generation.comfyui.api_key | COMFYUI_API_KEY | P16 |
| CFG-209 | image_generation.comfyui.workflow | COMFYUI_WORKFLOW | P16 |
| CFG-210 | image_generation.comfyui.nodes | COMFYUI_WORKFLOW_NODES | P16 |
| CFG-211 | image_generation.openai.api_base_url | IMAGES_OPENAI_API_BASE_URL | P04 |
| CFG-212 | image_generation.openai.api_version | IMAGES_OPENAI_API_VERSION | P04 |
| CFG-213 | image_generation.openai.api_key | IMAGES_OPENAI_API_KEY | P04 |
| CFG-214 | image_generation.openai.params | IMAGES_OPENAI_API_PARAMS | P04 |
| CFG-215 | image_generation.gemini.api_base_url | IMAGES_GEMINI_API_BASE_URL | P16 |
| CFG-216 | image_generation.gemini.api_key | IMAGES_GEMINI_API_KEY | P16 |
| CFG-217 | image_generation.gemini.endpoint_method | IMAGES_GEMINI_ENDPOINT_METHOD | P16 |
| CFG-218 | images.edit.enable | ENABLE_IMAGE_EDIT | P16 |
| CFG-219 | images.edit.engine | IMAGE_EDIT_ENGINE | P16 |
| CFG-220 | images.edit.model | IMAGE_EDIT_MODEL | P16 |
| CFG-221 | images.edit.size | IMAGE_EDIT_SIZE | P16 |
| CFG-222 | images.edit.openai.api_base_url | IMAGES_EDIT_OPENAI_API_BASE_URL | P04 |
| CFG-223 | images.edit.openai.api_version | IMAGES_EDIT_OPENAI_API_VERSION | P04 |
| CFG-224 | images.edit.openai.api_key | IMAGES_EDIT_OPENAI_API_KEY | P04 |
| CFG-225 | images.edit.gemini.api_base_url | IMAGES_EDIT_GEMINI_API_BASE_URL | P16 |
| CFG-226 | images.edit.gemini.api_key | IMAGES_EDIT_GEMINI_API_KEY | P16 |
| CFG-227 | images.edit.comfyui.base_url | IMAGES_EDIT_COMFYUI_BASE_URL | P16 |
| CFG-228 | images.edit.comfyui.api_key | IMAGES_EDIT_COMFYUI_API_KEY | P16 |
| CFG-229 | images.edit.comfyui.workflow | IMAGES_EDIT_COMFYUI_WORKFLOW | P16 |
| CFG-230 | images.edit.comfyui.nodes | IMAGES_EDIT_COMFYUI_WORKFLOW_NODES | P16 |
| CFG-231 | audio.stt.whisper_model | WHISPER_MODEL | P15 |
| CFG-232 | audio.stt.deepgram.api_key | DEEPGRAM_API_KEY | P15 |
| CFG-233 | audio.stt.openai.api_base_url | AUDIO_STT_OPENAI_API_BASE_URL | P04 |
| CFG-234 | audio.stt.openai.api_key | AUDIO_STT_OPENAI_API_KEY | P04 |
| CFG-235 | audio.stt.openai.api_request_format | AUDIO_STT_OPENAI_API_REQUEST_FORMAT | P04 |
| CFG-236 | audio.stt.engine | AUDIO_STT_ENGINE | P15 |
| CFG-237 | audio.stt.model | AUDIO_STT_MODEL | P15 |
| CFG-238 | audio.stt.supported_content_types | AUDIO_STT_SUPPORTED_CONTENT_TYPES | P15 |
| CFG-239 | audio.stt.allowed_extensions | AUDIO_STT_ALLOWED_EXTENSIONS | P15 |
| CFG-240 | audio.stt.azure.api_key | AUDIO_STT_AZURE_API_KEY | P15 |
| CFG-241 | audio.stt.azure.region | AUDIO_STT_AZURE_REGION | P15 |
| CFG-242 | audio.stt.azure.locales | AUDIO_STT_AZURE_LOCALES | P15 |
| CFG-243 | audio.stt.azure.base_url | AUDIO_STT_AZURE_BASE_URL | P15 |
| CFG-244 | audio.stt.azure.max_speakers | AUDIO_STT_AZURE_MAX_SPEAKERS | P15 |
| CFG-245 | audio.stt.mistral.api_key | AUDIO_STT_MISTRAL_API_KEY | P15 |
| CFG-246 | audio.stt.mistral.api_base_url | AUDIO_STT_MISTRAL_API_BASE_URL | P15 |
| CFG-247 | audio.stt.mistral.use_chat_completions | AUDIO_STT_MISTRAL_USE_CHAT_COMPLETIONS | P15 |
| CFG-248 | audio.tts.openai.api_base_url | AUDIO_TTS_OPENAI_API_BASE_URL | P04 |
| CFG-249 | audio.tts.openai.api_key | AUDIO_TTS_OPENAI_API_KEY | P04 |
| CFG-250 | audio.tts.openai.params | AUDIO_TTS_OPENAI_PARAMS | P04 |
| CFG-251 | audio.tts.api_key | AUDIO_TTS_API_KEY | P15 |
| CFG-252 | audio.realtime.enabled | AUDIO_REALTIME_ENABLED | P15 |
| CFG-253 | audio.realtime.openai.api_base_url | AUDIO_REALTIME_OPENAI_API_BASE_URL | P04 |
| CFG-254 | audio.realtime.openai.api_key | AUDIO_REALTIME_OPENAI_API_KEY | P04 |
| CFG-255 | audio.realtime.model | AUDIO_REALTIME_MODEL | P15 |
| CFG-256 | audio.realtime.voice | AUDIO_REALTIME_VOICE | P15 |
| CFG-257 | audio.realtime.transcription_model | AUDIO_REALTIME_TRANSCRIPTION_MODEL | P15 |
| CFG-258 | audio.realtime.prompt_template | REALTIME_CALL_PROMPT_TEMPLATE | P15 |
| CFG-259 | audio.tts.engine | AUDIO_TTS_ENGINE | P15 |
| CFG-260 | audio.tts.model | AUDIO_TTS_MODEL | P15 |
| CFG-261 | audio.tts.voice | AUDIO_TTS_VOICE | P15 |
| CFG-262 | audio.tts.realtime.prompt_template | REALTIME_TTS_PROMPT_TEMPLATE | P15 |
| CFG-263 | audio.tts.split_on | AUDIO_TTS_SPLIT_ON | P15 |
| CFG-264 | audio.tts.azure.speech_region | AUDIO_TTS_AZURE_SPEECH_REGION | P15 |
| CFG-265 | audio.tts.azure.speech_base_url | AUDIO_TTS_AZURE_SPEECH_BASE_URL | P15 |
| CFG-266 | audio.tts.azure.speech_output_format | AUDIO_TTS_AZURE_SPEECH_OUTPUT_FORMAT | P15 |
| CFG-267 | audio.tts.mistral.api_key | AUDIO_TTS_MISTRAL_API_KEY | P15 |
| CFG-268 | audio.tts.mistral.api_base_url | AUDIO_TTS_MISTRAL_API_BASE_URL | P15 |
| CFG-269 | webui.url | WEBUI_URL | P23 |
| CFG-270 | ui.enable_signup | ENABLE_SIGNUP | P23 |
| CFG-271 | ui.enable_login_form | ENABLE_LOGIN_FORM | P23 |
| CFG-272 | ui.enable_password_change_form | ENABLE_PASSWORD_CHANGE_FORM | P23 |
| CFG-273 | ui.default_locale | DEFAULT_LOCALE | P23 |
| CFG-274 | ui.default_models | DEFAULT_MODELS | P10 |
| CFG-275 | ui.default_pinned_models | DEFAULT_PINNED_MODELS | P10 |
| CFG-276 | ui.default_interface_settings | DEFAULT_INTERFACE_SETTINGS | P08 |
| CFG-277 | ui.i18n | {"entries":[]} | P23 |
| CFG-278 | ui.prompt_suggestions | DEFAULT_PROMPT_SUGGESTIONS | P11 |
| CFG-279 | ui.prompt_suggestions_i18n | DEFAULT_PROMPT_SUGGESTIONS_I18N | P11 |
| CFG-280 | ui.model_order_list | MODEL_ORDER_LIST | P10 |
| CFG-281 | models.default_metadata | DEFAULT_MODEL_METADATA | P10 |
| CFG-282 | models.default_params | DEFAULT_MODEL_PARAMS | P10 |
| CFG-283 | ui.default_user_role | DEFAULT_USER_ROLE | P23 |
| CFG-284 | ui.default_group_id | DEFAULT_GROUP_ID | P03 |
| CFG-285 | ui.pending_user_overlay_title | PENDING_USER_OVERLAY_TITLE | P23 |
| CFG-286 | ui.pending_user_overlay_content | PENDING_USER_OVERLAY_CONTENT | P23 |
| CFG-287 | ui.watermark | RESPONSE_WATERMARK | P23 |
| CFG-288 | user.permissions | USER_PERMISSIONS | P03 |
| CFG-289 | folders.enable | ENABLE_FOLDERS | P06 |
| CFG-290 | folders.max_file_count | FOLDER_MAX_FILE_COUNT | P06 |
| CFG-291 | channels.enable | ENABLE_CHANNELS | P17 |
| CFG-292 | channels.model_response_mode | CHANNEL_MODEL_RESPONSE_MODE | P17 |
| CFG-293 | calendar.enable | ENABLE_CALENDAR | P19 |
| CFG-294 | automations.enable | ENABLE_AUTOMATIONS | P20 |
| CFG-295 | subagents.enable | ENABLE_SUBAGENTS | P20 |
| CFG-296 | subagents.background_enabled | SUBAGENTS_BACKGROUND_ENABLED | P20 |
| CFG-297 | subagents.max_concurrent | SUBAGENTS_MAX_CONCURRENT | P20 |
| CFG-298 | subagents.max_async | SUBAGENTS_MAX_ASYNC | P20 |
| CFG-299 | subagents.max_iterations | SUBAGENTS_MAX_ITERATIONS | P20 |
| CFG-300 | subagents.max_output | SUBAGENTS_MAX_OUTPUT | P20 |
| CFG-301 | subagents.system_prompt | SUBAGENTS_SYSTEM_PROMPT | P20 |
| CFG-302 | automations.max_count | AUTOMATION_MAX_COUNT | P20 |
| CFG-303 | automations.min_interval | AUTOMATION_MIN_INTERVAL | P20 |
| CFG-304 | automations.auth_token_expires_in | AUTOMATION_AUTH_TOKEN_EXPIRES_IN | P02 |
| CFG-305 | notes.enable | ENABLE_NOTES | P18 |
| CFG-306 | users.enable_status | ENABLE_USER_STATUS | P23 |
| CFG-307 | evaluation.arena.enable | ENABLE_EVALUATION_ARENA_MODELS | P22 |
| CFG-308 | evaluation.arena.models | EVALUATION_ARENA_MODELS | P22 |
| CFG-309 | webhook_url | WEBHOOK_URL | P23 |
| CFG-310 | ui.enable_community_sharing | ENABLE_COMMUNITY_SHARING | P23 |
| CFG-311 | ui.enable_message_rating | ENABLE_MESSAGE_RATING | P23 |
| CFG-312 | ui.enable_user_webhooks | ENABLE_USER_WEBHOOKS | P23 |
| CFG-313 | ui.banners | WEBUI_BANNERS | P23 |
| CFG-314 | auth.admin.show | SHOW_ADMIN_DETAILS | P02 |
| CFG-315 | auth.admin.email | ADMIN_EMAIL | P02 |
| CFG-316 | task.model.default | TASK_MODEL | P10 |
| CFG-317 | task.model.external | TASK_MODEL_EXTERNAL | P10 |
| CFG-318 | task.model.params | TASK_MODEL_PARAMS | P10 |
| CFG-319 | chat.context_compaction.model | CONTEXT_COMPACTION_MODEL | P10 |
| CFG-320 | chat.context_compaction.enable | ENABLE_CONTEXT_COMPACTION | P05 |
| CFG-321 | chat.context_compaction.token_threshold | CONTEXT_COMPACTION_TOKEN_THRESHOLD | P05 |
| CFG-322 | chat.context_compaction.token_cap | CONTEXT_COMPACTION_TOKEN_CAP | P05 |
| CFG-323 | chat.context_compaction.retention_percentage | CONTEXT_COMPACTION_RETENTION_PERCENTAGE | P05 |
| CFG-324 | chat.context_compaction.prompt_template | CONTEXT_COMPACTION_PROMPT_TEMPLATE | P11 |
| CFG-325 | chat.tool_permissions.enable | ENABLE_TOOL_PERMISSIONS | P03 |
| CFG-326 | chat.tool_search.enable | ENABLE_TOOL_SEARCH | P12 |
| CFG-327 | chat.tool_search.defer_threshold | TOOL_SEARCH_DEFER_THRESHOLD | P12 |
| CFG-328 | chat.tool_search.always_loaded | TOOL_SEARCH_ALWAYS_LOADED | P12 |
| CFG-329 | chat.tool_search.defer_builtin_tools | TOOL_SEARCH_DEFER_BUILTIN_TOOLS | P12 |
| CFG-330 | task.title.prompt_template | TITLE_GENERATION_PROMPT_TEMPLATE | P11 |
| CFG-331 | task.tags.prompt_template | TAGS_GENERATION_PROMPT_TEMPLATE | P11 |
| CFG-332 | task.image.prompt_template | IMAGE_PROMPT_GENERATION_PROMPT_TEMPLATE | P16 |
| CFG-333 | task.follow_up.prompt_template | FOLLOW_UP_GENERATION_PROMPT_TEMPLATE | P11 |
| CFG-334 | task.follow_up.enable | ENABLE_FOLLOW_UP_GENERATION | P23 |
| CFG-335 | task.tags.enable | ENABLE_TAGS_GENERATION | P23 |
| CFG-336 | task.title.enable | ENABLE_TITLE_GENERATION | P23 |
| CFG-337 | task.query.search.enable | ENABLE_SEARCH_QUERY_GENERATION | P23 |
| CFG-338 | task.query.retrieval.enable | ENABLE_RETRIEVAL_QUERY_GENERATION | P23 |
| CFG-339 | task.query.prompt_template | QUERY_GENERATION_PROMPT_TEMPLATE | P11 |
| CFG-340 | task.autocomplete.enable | ENABLE_AUTOCOMPLETE_GENERATION | P23 |
| CFG-341 | task.autocomplete.input_max_length | AUTOCOMPLETE_GENERATION_INPUT_MAX_LENGTH | P23 |
| CFG-342 | task.autocomplete.prompt_template | AUTOCOMPLETE_GENERATION_PROMPT_TEMPLATE | P11 |
| CFG-343 | task.voice.prompt_template | VOICE_MODE_PROMPT_TEMPLATE | P15 |
| CFG-344 | task.voice.prompt.enable | ENABLE_VOICE_MODE_PROMPT | P15 |
| CFG-345 | task.tools.prompt_template | TOOLS_FUNCTION_CALLING_PROMPT_TEMPLATE | P12 |
| CFG-346 | auth.enable_api_keys | ENABLE_API_KEYS | P02 |
| CFG-347 | auth.api_key.endpoint_restrictions | ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS | P02 |
| CFG-348 | auth.api_key.allowed_endpoints | API_KEYS_ALLOWED_ENDPOINTS | P02 |
| CFG-349 | auth.jwt_expiry | JWT_EXPIRES_IN | P02 |
| CFG-350 | auth.mfa.enable | ENABLE_MFA | P02 |
| CFG-351 | auth.mfa.allow_oauth_bypass | MFA_ALLOW_OAUTH_BYPASS | P02 |
| CFG-352 | auth.mfa.allow_trusted_header_bypass | MFA_ALLOW_TRUSTED_HEADER_BYPASS | P02 |
| CFG-353 | oauth.enable | ENABLE_OAUTH | P02 |
| CFG-354 | oauth.enable_signup | ENABLE_OAUTH_SIGNUP | P02 |
| CFG-355 | oauth.auto_redirect | OAUTH_AUTO_REDIRECT | P02 |
| CFG-356 | oauth.refresh_token.include_scope | OAUTH_REFRESH_TOKEN_INCLUDE_SCOPE | P02 |
| CFG-357 | oauth.merge_accounts_by_email | OAUTH_MERGE_ACCOUNTS_BY_EMAIL | P02 |
| CFG-358 | oauth.google.client_id | GOOGLE_CLIENT_ID | P02 |
| CFG-359 | oauth.google.client_secret | GOOGLE_CLIENT_SECRET | P02 |
| CFG-360 | oauth.google.scope | GOOGLE_OAUTH_SCOPE | P02 |
| CFG-361 | oauth.google.redirect_uri | GOOGLE_REDIRECT_URI | P02 |
| CFG-362 | oauth.microsoft.client_id | MICROSOFT_CLIENT_ID | P02 |
| CFG-363 | oauth.microsoft.client_secret | MICROSOFT_CLIENT_SECRET | P02 |
| CFG-364 | oauth.microsoft.tenant_id | MICROSOFT_CLIENT_TENANT_ID | P02 |
| CFG-365 | oauth.microsoft.login_base_url | MICROSOFT_CLIENT_LOGIN_BASE_URL | P02 |
| CFG-366 | oauth.microsoft.picture_url | MICROSOFT_CLIENT_PICTURE_URL | P02 |
| CFG-367 | oauth.microsoft.scope | MICROSOFT_OAUTH_SCOPE | P02 |
| CFG-368 | oauth.microsoft.redirect_uri | MICROSOFT_REDIRECT_URI | P02 |
| CFG-369 | oauth.github.client_id | GITHUB_CLIENT_ID | P02 |
| CFG-370 | oauth.github.client_secret | GITHUB_CLIENT_SECRET | P02 |
| CFG-371 | oauth.github.scope | GITHUB_CLIENT_SCOPE | P02 |
| CFG-372 | oauth.github.redirect_uri | GITHUB_CLIENT_REDIRECT_URI | P02 |
| CFG-373 | oauth.client_id | OAUTH_CLIENT_ID | P02 |
| CFG-374 | oauth.client_secret | OAUTH_CLIENT_SECRET | P02 |
| CFG-375 | oauth.provider_url | OPENID_PROVIDER_URL | P02 |
| CFG-376 | oauth.end_session_endpoint | OPENID_END_SESSION_ENDPOINT | P02 |
| CFG-377 | oauth.redirect_uri | OPENID_REDIRECT_URI | P02 |
| CFG-378 | oauth.scopes | OAUTH_SCOPES | P02 |
| CFG-379 | oauth.timeout | OAUTH_TIMEOUT | P02 |
| CFG-380 | oauth.token_endpoint_auth_method | OAUTH_TOKEN_ENDPOINT_AUTH_METHOD | P02 |
| CFG-381 | oauth.code_challenge_method | OAUTH_CODE_CHALLENGE_METHOD | P02 |
| CFG-382 | oauth.provider_name | OAUTH_PROVIDER_NAME | P02 |
| CFG-383 | oauth.sub_claim | OAUTH_SUB_CLAIM | P02 |
| CFG-384 | oauth.username_claim | OAUTH_USERNAME_CLAIM | P02 |
| CFG-385 | oauth.picture_claim | OAUTH_PICTURE_CLAIM | P02 |
| CFG-386 | oauth.email_claim | OAUTH_EMAIL_CLAIM | P02 |
| CFG-387 | oauth.group_claim | OAUTH_GROUPS_CLAIM | P02 |
| CFG-388 | oauth.feishu.client_id | FEISHU_CLIENT_ID | P02 |
| CFG-389 | oauth.feishu.client_secret | FEISHU_CLIENT_SECRET | P02 |
| CFG-390 | oauth.feishu.scope | FEISHU_OAUTH_SCOPE | P02 |
| CFG-391 | oauth.feishu.redirect_uri | FEISHU_REDIRECT_URI | P02 |
| CFG-392 | oauth.enable_role_mapping | ENABLE_OAUTH_ROLE_MANAGEMENT | P02 |
| CFG-393 | oauth.enable_group_mapping | ENABLE_OAUTH_GROUP_MANAGEMENT | P02 |
| CFG-394 | oauth.enable_group_creation | ENABLE_OAUTH_GROUP_CREATION | P02 |
| CFG-395 | oauth.group_default_share | OAUTH_GROUP_DEFAULT_SHARE | P02 |
| CFG-396 | oauth.blocked_groups | OAUTH_BLOCKED_GROUPS | P02 |
| CFG-397 | oauth.roles_claim | OAUTH_ROLES_CLAIM | P02 |
| CFG-398 | oauth.allowed_roles | OAUTH_ALLOWED_ROLES | P02 |
| CFG-399 | oauth.admin_roles | OAUTH_ADMIN_ROLES | P02 |
| CFG-400 | oauth.allowed_domains | OAUTH_ALLOWED_DOMAINS | P02 |
| CFG-401 | oauth.update_picture_on_login | OAUTH_UPDATE_PICTURE_ON_LOGIN | P02 |
| CFG-402 | oauth.update_name_on_login | OAUTH_UPDATE_NAME_ON_LOGIN | P02 |
| CFG-403 | oauth.update_email_on_login | OAUTH_UPDATE_EMAIL_ON_LOGIN | P02 |
| CFG-404 | oauth.audience | OAUTH_AUDIENCE | P02 |
| CFG-405 | ldap.enable | ENABLE_LDAP | P23 |
| CFG-406 | ldap.server.label | LDAP_SERVER_LABEL | P23 |
| CFG-407 | ldap.server.host | LDAP_SERVER_HOST | P23 |
| CFG-408 | ldap.server.port | LDAP_SERVER_PORT | P23 |
| CFG-409 | ldap.server.attribute_for_mail | LDAP_ATTRIBUTE_FOR_MAIL | P23 |
| CFG-410 | ldap.server.attribute_for_username | LDAP_ATTRIBUTE_FOR_USERNAME | P23 |
| CFG-411 | ldap.server.app_dn | LDAP_APP_DN | P23 |
| CFG-412 | ldap.server.app_password | LDAP_APP_PASSWORD | P23 |
| CFG-413 | ldap.server.users_dn | LDAP_SEARCH_BASE | P23 |
| CFG-414 | ldap.server.search_filter | LDAP_SEARCH_FILTERS | P23 |
| CFG-415 | ldap.server.use_tls | LDAP_USE_TLS | P23 |
| CFG-416 | ldap.server.ca_cert_file | LDAP_CA_CERT_FILE | P09 |
| CFG-417 | ldap.server.validate_cert | LDAP_VALIDATE_CERT | P23 |
| CFG-418 | ldap.server.ciphers | LDAP_CIPHERS | P23 |
| CFG-419 | ldap.group.enable_management | ENABLE_LDAP_GROUP_MANAGEMENT | P03 |
| CFG-420 | ldap.group.enable_creation | ENABLE_LDAP_GROUP_CREATION | P03 |
| CFG-421 | ldap.server.attribute_for_groups | LDAP_ATTRIBUTE_FOR_GROUPS | P03 |

## Settings surfaces

Referenced keys adalah hasil pencarian static, tidak menjamin seluruh binding dinamis ditemukan; source surface review tetap wajib.

| ID | Surface | Referenced keys | Owner |
|---|---|---|---|
| SET-001 | src/lib/components/admin/Settings/AdminSettingField.svelte |  | P23 |
| SET-002 | src/lib/components/admin/Settings/AdminSettingRow.svelte |  | P23 |
| SET-003 | src/lib/components/admin/Settings/AdminSettingSection.svelte |  | P23 |
| SET-004 | src/lib/components/admin/Settings/AdminTabIcon.svelte |  | P23 |
| SET-005 | src/lib/components/admin/Settings/Audio.svelte | admin.audio.additionalParameters.description, admin.audio.additionalParameters.label, admin.audio.languageLocales.label, admin.audio.maxSpeakers.label, admin.audio.mistralSttModel.description, admin.audio.mistralSttModel.label, admin.audio.outputFormat.label, admin.audio.requestFormat.description, admin.audio.requestFormat.label, admin.audio.responseSplitting.description, admin.audio.responseSplitting.label, admin.audio.sections.speechToText.title, admin.audio.sections.textToSpeech.title, admin.audio.speechToTextEngine.description, admin.audio.speechToTextEngine.label, admin.audio.sttAzureApiKey.label, admin.audio.sttAzureBaseUrl.label, admin.audio.sttAzureRegion.label, admin.audio.sttDeepgramApiKey.label, admin.audio.sttMistralApiBaseUrl.label, admin.audio.sttMistralApiKey.label, admin.audio.sttModel.description, admin.audio.sttModel.label, admin.audio.sttOpenaiApiBaseUrl.label, admin.audio.sttOpenaiApiKey.label, admin.audio.sttWhisperModel.description, admin.audio.sttWhisperModel.label, admin.audio.supportedMimeTypes.description, admin.audio.supportedMimeTypes.label, admin.audio.textToSpeechEngine.description, admin.audio.textToSpeechEngine.label, admin.audio.title, admin.audio.ttsApiKey.label, admin.audio.ttsAzureSpeechBaseUrl.label, admin.audio.ttsAzureSpeechRegion.label, admin.audio.ttsMistralApiBaseUrl.label, admin.audio.ttsMistralApiKey.label, admin.audio.ttsModel.description, admin.audio.ttsModel.label, admin.audio.ttsOpenaiApiBaseUrl.label, admin.audio.ttsOpenaiApiKey.label, admin.audio.ttsVoice.label, admin.audio.updateModel.label, admin.audio.useChatCompletionsApi.description, admin.audio.useChatCompletionsApi.label, features, set | P15 |
| SET-006 | src/lib/components/admin/Settings/Authentication.svelte | admin.authentication.adminContactEmail.description, admin.authentication.adminContactEmail.label, admin.authentication.adminDetails.description, admin.authentication.adminDetails.label, admin.authentication.adminRoles.description, admin.authentication.adminRoles.label, admin.authentication.allowedDomains.description, admin.authentication.allowedDomains.label, admin.authentication.allowedEndpoints.description, admin.authentication.allowedEndpoints.label, admin.authentication.allowedRoles.description, admin.authentication.allowedRoles.label, admin.authentication.apiKeyEndpointRestrictions.description, admin.authentication.apiKeyEndpointRestrictions.label, admin.authentication.apiKeys.description, admin.authentication.apiKeys.label, admin.authentication.applicationDn.description, admin.authentication.applicationDn.label, admin.authentication.applicationDnPassword.description, admin.authentication.applicationDnPassword.label, admin.authentication.attributeForMail.description, admin.authentication.attributeForMail.label, admin.authentication.attributeForUsername.description, admin.authentication.attributeForUsername.label, admin.authentication.autoRedirect.description, admin.authentication.autoRedirect.label, admin.authentication.blockedGroups.description, admin.authentication.blockedGroups.label, admin.authentication.certificatePath.description, admin.authentication.certificatePath.label, admin.authentication.ciphers.description, admin.authentication.ciphers.label, admin.authentication.clientId.description, admin.authentication.clientId.label, admin.authentication.clientSecret.description, admin.authentication.clientSecret.label, admin.authentication.defaultGroup.description, admin.authentication.defaultGroup.label, admin.authentication.defaultUserRole.description, admin.authentication.defaultUserRole.label, admin.authentication.emailClaim.description, admin.authentication.emailClaim.label, admin.authentication.enableGroupCreation.description, admin.authentication.enableGroupCreation.label, admin.authentication.enableGroupManagement.description, admin.authentication.enableGroupManagement.label, admin.authentication.enableOauthGroupCreation.description, admin.authentication.enableOauthGroupCreation.label, admin.authentication.enableOauthGroupManagement.description, admin.authentication.enableOauthGroupManagement.label, admin.authentication.groupAttribute.description, admin.authentication.groupAttribute.label, admin.authentication.groupClaim.description, admin.a | P02 |
| SET-007 | src/lib/components/admin/Settings/CodeExecution.svelte | CODE_EXECUTION_ENGINE, CODE_EXECUTION_JUPYTER_AUTH, CODE_EXECUTION_JUPYTER_AUTH_PASSWORD, CODE_EXECUTION_JUPYTER_AUTH_TOKEN, CODE_EXECUTION_JUPYTER_TIMEOUT, CODE_EXECUTION_JUPYTER_URL, CODE_INTERPRETER_ENGINE, CODE_INTERPRETER_JUPYTER_AUTH, CODE_INTERPRETER_JUPYTER_AUTH_PASSWORD, CODE_INTERPRETER_JUPYTER_AUTH_TOKEN, CODE_INTERPRETER_JUPYTER_TIMEOUT, CODE_INTERPRETER_JUPYTER_URL, CODE_INTERPRETER_PROMPT_TEMPLATE, ENABLE_CODE_EXECUTION, ENABLE_CODE_INTERPRETER, admin.codeExecution.codeExecutionEngine.description, admin.codeExecution.codeExecutionEngine.label, admin.codeExecution.codeExecutionJupyterAuth.description, admin.codeExecution.codeExecutionJupyterAuth.label, admin.codeExecution.codeExecutionJupyterAuthPassword.description, admin.codeExecution.codeExecutionJupyterAuthPassword.label, admin.codeExecution.codeExecutionJupyterAuthToken.label, admin.codeExecution.codeExecutionJupyterTimeout.description, admin.codeExecution.codeExecutionJupyterTimeout.label, admin.codeExecution.codeExecutionJupyterUrl.description, admin.codeExecution.codeExecutionJupyterUrl.label, admin.codeExecution.codeInterpreterEngine.description, admin.codeExecution.codeInterpreterEngine.label, admin.codeExecution.codeInterpreterJupyterAuth.description, admin.codeExecution.codeInterpreterJupyterAuth.label, admin.codeExecution.codeInterpreterJupyterAuthPassword.description, admin.codeExecution.codeInterpreterJupyterAuthPassword.label, admin.codeExecution.codeInterpreterJupyterAuthToken.label, admin.codeExecution.codeInterpreterJupyterTimeout.description, admin.codeExecution.codeInterpreterJupyterTimeout.label, admin.codeExecution.codeInterpreterJupyterUrl.description, admin.codeExecution.codeInterpreterJupyterUrl.label, admin.codeExecution.codeInterpreterPromptTemplate.description, admin.codeExecution.codeInterpreterPromptTemplate.label, admin.codeExecution.enableCodeExecution.description, admin.codeExecution.enableCodeExecution.label, admin.codeExecution.enableCodeInterpreter.description, admin.codeExecution.enableCodeInterpreter.label, admin.codeExecution.sections.codeExecution.title, admin.codeExecution.sections.codeInterpreter.title, admin.codeExecution.title | P21 |
| SET-008 | src/lib/components/admin/Settings/Connections/ManageOllamaModal.svelte |  | P04 |
| SET-009 | src/lib/components/admin/Settings/Connections/OllamaConnection.svelte | enable, key | P04 |
| SET-010 | src/lib/components/admin/Settings/Connections/OpenAIConnection.svelte | enable | P04 |
| SET-011 | src/lib/components/admin/Settings/Connections.svelte | admin.connections.addConnection.label, admin.connections.cacheBaseModelList.description, admin.connections.cacheBaseModelList.label, admin.connections.directConnections.description, admin.connections.directConnections.label, admin.connections.manageOllamaApiConnections.description, admin.connections.manageOllamaApiConnections.label, admin.connections.manageOpenaiApiConnections.label, admin.connections.ollamaApi.label, admin.connections.openaiApi.label, admin.connections.refreshModels.label, admin.connections.sections.userConnections.title, admin.connections.title, directConnections, features, set | P04 |
| SET-012 | src/lib/components/admin/Settings/Database.svelte | admin.db.allChats.description, admin.db.allChats.label, admin.db.database.description, admin.db.database.label, admin.db.exportConfig.description, admin.db.exportConfig.label, admin.db.importConfig.description, admin.db.importConfig.label, admin.db.sections.config.title, admin.db.sections.export.title, admin.db.title, admin.db.users.description, admin.db.users.label, features.enable_admin_export | P23 |
| SET-013 | src/lib/components/admin/Settings/Documents.svelte | ALLOWED_FILE_EXTENSIONS, CONTENT_EXTRACTION_SUPPORTED_MEDIA_MIME_TYPES, DOCLING_PARAMS, EXTERNAL_DOCUMENT_LOADER_HEADERS, MINERU_FILE_EXTENSIONS, MINERU_PARAMS, RAG_TOKENIZER_MODEL, admin.documents.additionalConfig.description, admin.documents.additionalConfig.label, admin.documents.allowedFileExtensions.description, admin.documents.allowedFileExtensions.label, admin.documents.apiMode.description, admin.documents.apiMode.label, admin.documents.apiTimeout.description, admin.documents.apiTimeout.label, admin.documents.apiToken.description, admin.documents.apiToken.label, admin.documents.apiUrl.description, admin.documents.apiUrl.label, admin.documents.asyncEmbeddingProcessing.description, admin.documents.asyncEmbeddingProcessing.label, admin.documents.azureopenaikey.description, admin.documents.azureopenaikey.label, admin.documents.azureopenaiurl.description, admin.documents.azureopenaiurl.label, admin.documents.bm25Weight.description, admin.documents.bm25Weight.label, admin.documents.bypassEmbeddingAndRetrieval.description, admin.documents.bypassEmbeddingAndRetrieval.label, admin.documents.chunkMinSizeTarget.description, admin.documents.chunkMinSizeTarget.label, admin.documents.chunkOverlap.description, admin.documents.chunkOverlap.label, admin.documents.chunkSize.description, admin.documents.chunkSize.label, admin.documents.contentExtractionEngine.description, admin.documents.contentExtractionEngine.label, admin.documents.datalabMarkerApiBaseUrl.description, admin.documents.datalabMarkerApiBaseUrl.label, admin.documents.datalabMarkerApiKey.description, admin.documents.datalabMarkerApiKey.label, admin.documents.disableImageExtraction.description, admin.documents.disableImageExtraction.label, admin.documents.doclingApiKey.description, admin.documents.doclingApiKey.label, admin.documents.doclingParams.description, admin.documents.doclingParams.label, admin.documents.doclingServerUrl.description, admin.documents.doclingServerUrl.label, admin.documents.documentIntelligenceKey.description, admin.documents.documentIntelligenceKey.label, admin.documents.documentIntelligenceModel.description, admin.documents.documentIntelligenceModel.label, admin.documents.documentLoaderUrl.description, admin.documents.documentLoaderUrl.label, admin.documents.embeddingBatchSize.description, admin.documents.embeddingBatchSize.label, admin.documents.embeddingConcurrentRequests.description, admin.documents.embeddingConcurrentRequests.label, admin.documents.embeddingModel.description,  | P13 |
| SET-014 | src/lib/components/admin/Settings/Evaluations/ArenaModelModal.svelte |  | P22 |
| SET-015 | src/lib/components/admin/Settings/Evaluations/Model.svelte |  | P22 |
| SET-016 | src/lib/components/admin/Settings/Evaluations.svelte | admin.evaluations.addArenaModel.label, admin.evaluations.arenaModels.description, admin.evaluations.arenaModels.label, admin.evaluations.sections.models.title, admin.evaluations.title, directConnections, features | P22 |
| SET-017 | src/lib/components/admin/Settings/Events.svelte | admin.general.events.events.label, admin.general.events.webhooks.description, admin.general.events.webhooks.label | P23 |
| SET-018 | src/lib/components/admin/Settings/ExternalKnowledge.svelte | admin.integrations.externalKnowledge.addConnection.label, admin.integrations.externalKnowledge.title, collection_field, db_name, table_name, timeout | P13 |
| SET-019 | src/lib/components/admin/Settings/General.svelte | admin.general.addBanner.label, admin.general.automations.description, admin.general.automations.label, admin.general.banners.label, admin.general.calendar.description, admin.general.calendar.label, admin.general.channels.description, admin.general.channels.label, admin.general.checkForUpdates.label, admin.general.communitySharing.description, admin.general.communitySharing.label, admin.general.folderMaxFileCount.description, admin.general.folderMaxFileCount.label, admin.general.folders.description, admin.general.folders.label, admin.general.help.description, admin.general.help.label, admin.general.license.label, admin.general.memories.description, admin.general.memories.label, admin.general.memorySystemContext.description, admin.general.memorySystemContext.label, admin.general.messageRating.description, admin.general.messageRating.label, admin.general.modelResponseMode.description, admin.general.modelResponseMode.label, admin.general.notes.description, admin.general.notes.label, admin.general.responseWatermark.description, admin.general.responseWatermark.label, admin.general.sections.features.title, admin.general.sections.ui.title, admin.general.seeWhatSNew.label, admin.general.title, admin.general.userStatus.description, admin.general.userStatus.label, admin.general.userWebhooks.description, admin.general.userWebhooks.label, admin.general.version.label, admin.general.webuiUrl.description, admin.general.webuiUrl.label, features, license_metadata, set | P23 |
| SET-020 | src/lib/components/admin/Settings/I18nSettings.svelte | admin.general.translations.addTranslation.label, admin.general.translations.uiTranslations.label | P23 |
| SET-021 | src/lib/components/admin/Settings/Images.svelte | AUTOMATIC1111_API_AUTH, AUTOMATIC1111_BASE_URL, AUTOMATIC1111_PARAMS, AUTOMATIC1111_PARAMS.trim, COMFYUI_API_KEY, COMFYUI_BASE_URL, COMFYUI_WORKFLOW, COMFYUI_WORKFLOW_NODES, COMFYUI_WORKFLOW_NODES.find, ENABLE_IMAGE_EDIT, ENABLE_IMAGE_GENERATION, ENABLE_IMAGE_PROMPT_GENERATION, IMAGES_EDIT_COMFYUI_API_KEY, IMAGES_EDIT_COMFYUI_BASE_URL, IMAGES_EDIT_COMFYUI_WORKFLOW, IMAGES_EDIT_COMFYUI_WORKFLOW_NODES, IMAGES_EDIT_COMFYUI_WORKFLOW_NODES.find, IMAGES_EDIT_GEMINI_API_BASE_URL, IMAGES_EDIT_GEMINI_API_KEY, IMAGES_EDIT_OPENAI_API_BASE_URL, IMAGES_EDIT_OPENAI_API_KEY, IMAGES_EDIT_OPENAI_API_VERSION, IMAGES_GEMINI_API_BASE_URL, IMAGES_GEMINI_API_KEY, IMAGES_GEMINI_ENDPOINT_METHOD, IMAGES_OPENAI_API_BASE_URL, IMAGES_OPENAI_API_KEY, IMAGES_OPENAI_API_PARAMS, IMAGES_OPENAI_API_PARAMS.trim, IMAGES_OPENAI_API_VERSION, IMAGE_EDIT_ENGINE, IMAGE_EDIT_MODEL, IMAGE_EDIT_SIZE, IMAGE_GENERATION_ENGINE, IMAGE_GENERATION_MODEL, IMAGE_SIZE, IMAGE_STEPS, admin.images.apiAuthString.description, admin.images.apiAuthString.label, admin.images.automatic1111BaseUrl.description, admin.images.automatic1111BaseUrl.label, admin.images.automatic1111Params.description, admin.images.automatic1111Params.label, admin.images.clickHereToUploadAWorkflowJsonFile.label, admin.images.comfyuiApiKey.description, admin.images.comfyuiApiKey.label, admin.images.comfyuiBaseUrl.description, admin.images.comfyuiBaseUrl.label, admin.images.comfyuiComfyuiWorkflow.description, admin.images.comfyuiComfyuiWorkflow.label, admin.images.editWorkflowJsonContent.label, admin.images.editingWorkflowNodes.description, admin.images.editingWorkflowNodes.label, admin.images.geminiEndpointMethod.description, admin.images.geminiEndpointMethod.label, admin.images.generationWorkflowNodes.description, admin.images.generationWorkflowNodes.label, admin.images.imageEdit.description, admin.images.imageEdit.label, admin.images.imageEditEngine.description, admin.images.imageEditEngine.label, admin.images.imageEditModel.label, admin.images.imageEditSize.label, admin.images.imageGeneration.description, admin.images.imageGeneration.label, admin.images.imageGenerationEngine.description, admin.images.imageGenerationEngine.label, admin.images.imageGenerationModel.label, admin.images.imagePromptGeneration.description, admin.images.imagePromptGeneration.label, admin.images.imageSize.label, admin.images.imagesEditComfyuiApiKey.description, admin.images.imagesEditComfyuiApiKey.label, admin.images.imagesEditComfyuiBaseUrl.description, admin.imag | P16 |
| SET-022 | src/lib/components/admin/Settings/Integrations.svelte | admin.connections.directIntegrations.description, admin.connections.directIntegrations.label, admin.connections.sections.userConnections.title, admin.integrations.addConnection.label, admin.integrations.externalToolServers.label, admin.integrations.openTerminal.label, admin.integrations.sections.knowledge.title, admin.integrations.sections.terminal.title, admin.integrations.sections.tools.title, admin.integrations.title, features, set | P12 |
| SET-023 | src/lib/components/admin/Settings/Interface/Banners.svelte |  | P23 |
| SET-024 | src/lib/components/admin/Settings/Interface.svelte | admin.interface.autocompleteGeneration.description, admin.interface.autocompleteGeneration.label, admin.interface.autocompleteGenerationInputMaxLength.description, admin.interface.autocompleteGenerationInputMaxLength.label, admin.interface.autocompleteGenerationPrompt.description, admin.interface.autocompleteGenerationPrompt.label, admin.interface.availableVariables.label, admin.interface.contextCompaction.description, admin.interface.contextCompaction.label, admin.interface.contextCompactionModel.description, admin.interface.contextCompactionModel.label, admin.interface.contextCompactionPrompt.description, admin.interface.contextCompactionPrompt.label, admin.interface.externalTaskModel.label, admin.interface.followUpGeneration.description, admin.interface.followUpGeneration.label, admin.interface.followUpGenerationPrompt.description, admin.interface.followUpGenerationPrompt.label, admin.interface.imagePromptGenerationPrompt.description, admin.interface.imagePromptGenerationPrompt.label, admin.interface.localTaskModel.label, admin.interface.promptTemplate.description, admin.interface.promptTemplate.label, admin.interface.queryGenerationPrompt.description, admin.interface.queryGenerationPrompt.label, admin.interface.retainedMessages.description, admin.interface.retainedMessages.label, admin.interface.retrievalQueryGeneration.description, admin.interface.retrievalQueryGeneration.label, admin.interface.sections.chat.title, admin.interface.sections.generation.title, admin.interface.sections.tasks.title, admin.interface.tagsGeneration.description, admin.interface.tagsGeneration.label, admin.interface.tagsGenerationPrompt.description, admin.interface.tagsGenerationPrompt.label, admin.interface.taskModel.description, admin.interface.taskModel.label, admin.interface.taskModelParameters.label, admin.interface.title, admin.interface.titleGeneration.description, admin.interface.titleGeneration.label, admin.interface.titleGenerationPrompt.description, admin.interface.titleGenerationPrompt.label, admin.interface.tokenCap.description, admin.interface.tokenCap.label, admin.interface.tokenThreshold.description, admin.interface.tokenThreshold.label, admin.interface.toolPermissions.description, admin.interface.toolPermissions.label, admin.interface.toolSearch.description, admin.interface.toolSearch.label, admin.interface.toolSearchAlwaysLoaded.description, admin.interface.toolSearchAlwaysLoaded.label, admin.interface.toolSearchAlwaysLoaded.placeholder, admin.interface.toolS | P23 |
| SET-025 | src/lib/components/admin/Settings/Models/AdminViewSelector.svelte |  | P23 |
| SET-026 | src/lib/components/admin/Settings/Models/Manage/ManageMultipleOllama.svelte |  | P23 |
| SET-027 | src/lib/components/admin/Settings/Models/Manage/ManageMultipleProviderModels.svelte |  | P23 |
| SET-028 | src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte | directConnections, features | P23 |
| SET-029 | src/lib/components/admin/Settings/Models/Manage/ManageProviderModels.svelte | directConnections, features | P23 |
| SET-030 | src/lib/components/admin/Settings/Models/ManageModelsModal.svelte |  | P23 |
| SET-031 | src/lib/components/admin/Settings/Models/ModelControls.svelte |  | P23 |
| SET-032 | src/lib/components/admin/Settings/Models/ModelDefaultsPanel.svelte | DEFAULT_MODELS, DEFAULT_MODEL_METADATA, DEFAULT_MODEL_PARAMS, DEFAULT_PINNED_MODELS, MODEL_ORDER_LIST, admin.models.defaults.modelCapabilities.label, admin.models.defaults.modelDefaults.label, admin.models.defaults.modelParameters.label, admin.models.defaults.promptSuggestions.label | P23 |
| SET-033 | src/lib/components/admin/Settings/Models/ModelMenu.svelte |  | P23 |
| SET-034 | src/lib/components/admin/Settings/Models.svelte | admin.models.disableAllModels.label, admin.models.enableAllModels.label, admin.models.exportModels.label, admin.models.hideAllModels.label, admin.models.importModels.label, admin.models.manageModels.label, admin.models.resetModels.label, admin.models.showAllModels.label, admin.models.title, directConnections, features, pinnedModels, set | P23 |
| SET-035 | src/lib/components/admin/Settings/Pipelines.svelte | admin.pipelines.githubUrl.label, admin.pipelines.install.label, admin.pipelines.installing.label, admin.pipelines.pipeline.description, admin.pipelines.pipeline.label, admin.pipelines.pipelineUrl.description, admin.pipelines.pipelineUrl.label, admin.pipelines.sections.pipelines.title, admin.pipelines.sections.source.title, admin.pipelines.sections.valves.title, admin.pipelines.selectAPyFile.label, admin.pipelines.title, admin.pipelines.uploadPipeline.description, admin.pipelines.uploadPipeline.label, directConnections, features | P12 |
| SET-036 | src/lib/components/admin/Settings/Subagents.svelte | ENABLE_SUBAGENTS, SUBAGENTS_BACKGROUND_ENABLED, SUBAGENTS_MAX_ASYNC, SUBAGENTS_MAX_CONCURRENT, SUBAGENTS_MAX_ITERATIONS, SUBAGENTS_MAX_OUTPUT, SUBAGENTS_SYSTEM_PROMPT, admin.subagents.enableBackgroundSubAgents.description, admin.subagents.enableBackgroundSubAgents.label, admin.subagents.enableSubAgents.label, admin.subagents.maxBackground.label, admin.subagents.maxConcurrent.label, admin.subagents.maxIterations.label, admin.subagents.maxOutput.label, admin.subagents.systemPrompt.description, admin.subagents.systemPrompt.label, admin.subagents.title | P20 |
| SET-037 | src/lib/components/admin/Settings/WebSearch.svelte | admin.web.bingSearchV7Endpoint.label, admin.web.bingSearchV7SubscriptionKey.label, admin.web.bochaSearchApiKey.label, admin.web.braveSearchApiKey.label, admin.web.bypassEmbeddingAndRetrieval.description, admin.web.bypassEmbeddingAndRetrieval.label, admin.web.bypassWebLoader.description, admin.web.bypassWebLoader.label, admin.web.concurrentRequests.description, admin.web.concurrentRequests.label, admin.web.contextTokens.label, admin.web.ddgsBackend.label, admin.web.domainFilterList.description, admin.web.domainFilterList.label, admin.web.exaApiKey.label, admin.web.externalWebLoaderApiKey.label, admin.web.externalWebLoaderUrl.label, admin.web.externalWebSearchApiKey.label, admin.web.externalWebSearchUrl.label, admin.web.fetchUrlContentLengthLimit.description, admin.web.fetchUrlContentLengthLimit.label, admin.web.firecrawlApiBaseUrl.label, admin.web.firecrawlApiKey.label, admin.web.firecrawlTimeoutS.label, admin.web.googlePseApiKey.label, admin.web.googlePseEngineId.label, admin.web.jinaApiBaseUrl.label, admin.web.jinaApiKey.label, admin.web.kagiSearchApiKey.label, admin.web.language.label, admin.web.linkupApiKey.label, admin.web.maxContentLength.description, admin.web.maxContentLength.label, admin.web.microsoftWebIqApiBaseUrl.label, admin.web.microsoftWebIqApiKey.label, admin.web.mojeekSearchApiKey.label, admin.web.ollamaCloudApiKey.label, admin.web.openserpUrl.label, admin.web.parameters.label, admin.web.perplexityApiKey.label, admin.web.perplexityModel.label, admin.web.perplexitySearchApiUrl.label, admin.web.perplexitySearchContextUsage.label, admin.web.playwrightTimeoutMs.label, admin.web.playwrightWebsocketUrl.label, admin.web.searchLimits.description, admin.web.searchLimits.label, admin.web.searchResultCount.description, admin.web.searchResultCount.label, admin.web.searchapiApiKey.label, admin.web.searchapiEngine.label, admin.web.searxngQueryUrl.label, admin.web.searxngSearchLanguageAllEnEsDeFrEtc.label, admin.web.sections.loader.title, admin.web.sections.search.title, admin.web.serpapiApiKey.label, admin.web.serpapiEngine.label, admin.web.serperApiKey.label, admin.web.serphouseApiKey.label, admin.web.serphouseDomain.label, admin.web.serplyApiKey.label, admin.web.serpstackApiKey.label, admin.web.sougouSearchApiSid.label, admin.web.sougouSearchApiSk.label, admin.web.tavilyApiKey.label, admin.web.tavilyExtractDepth.label, admin.web.tavilySearchDepth.label, admin.web.timeout.description, admin.web.timeout.label, admin.web.title, admin.web.trustProxyEnviron | P14 |
| SET-038 | src/lib/components/chat/Settings/About.svelte | features, license_metadata, personal.about.checkForUpdates.label, personal.about.sections.community.title, personal.about.sections.ollamaVersion.title, personal.about.sections.version.title, personal.about.seeWhatSNew.description, personal.about.seeWhatSNew.label, personal.about.title | P08 |
| SET-039 | src/lib/components/chat/Settings/Account/Mfa.svelte |  | P02 |
| SET-040 | src/lib/components/chat/Settings/Account/UpdatePassword.svelte | personal.account.changePassword.description, personal.account.changePassword.label, personal.account.confirmPassword.label, personal.account.currentPassword.label, personal.account.newPassword.label, personal.account.updatePassword.label | P02 |
| SET-041 | src/lib/components/chat/Settings/Account/UserProfileImage.svelte |  | P02 |
| SET-042 | src/lib/components/chat/Settings/Account.svelte | features, features.enable_login_form, features.enable_password_change_form, personal.account.apiKey.description, personal.account.apiKey.label, personal.account.bio.description, personal.account.bio.label, personal.account.birthDate.description, personal.account.birthDate.label, personal.account.createNewSecretKey.label, personal.account.gender.description, personal.account.gender.label, personal.account.jwtToken.description, personal.account.jwtToken.label, personal.account.name.description, personal.account.name.label, personal.account.secrets.description, personal.account.secrets.label, personal.account.sections.apiKeys.title, personal.account.sections.password.title, personal.account.sections.profile.title, personal.account.title | P02 |
| SET-043 | src/lib/components/chat/Settings/Advanced/AdvancedParams.svelte | compact_token_threshold, custom_params, format, frequency_penalty, function_calling, keep_alive, logit_bias, max_tokens, min_p, mirostat, mirostat_eta, mirostat_tau, num_batch, num_ctx, num_gpu, num_keep, num_thread, personal.general.parameters.contextCompactionThreshold.description, personal.general.parameters.contextCompactionThreshold.label, personal.general.parameters.format.label, personal.general.parameters.frequencyPenalty.label, personal.general.parameters.functionCalling.description, personal.general.parameters.functionCalling.label, personal.general.parameters.keepAlive.label, personal.general.parameters.logitBias.label, personal.general.parameters.maxTokens.label, personal.general.parameters.minP.label, personal.general.parameters.mirostat.label, personal.general.parameters.mirostatEta.label, personal.general.parameters.mirostatTau.label, personal.general.parameters.numBatch.label, personal.general.parameters.numCtx.label, personal.general.parameters.numGpu.label, personal.general.parameters.numKeep.label, personal.general.parameters.numThread.label, personal.general.parameters.ollama.description, personal.general.parameters.ollama.label, personal.general.parameters.presencePenalty.label, personal.general.parameters.reasoningEffort.description, personal.general.parameters.reasoningEffort.label, personal.general.parameters.reasoningTags.description, personal.general.parameters.reasoningTags.label, personal.general.parameters.repeatLastN.label, personal.general.parameters.repeatPenalty.label, personal.general.parameters.seed.description, personal.general.parameters.seed.label, personal.general.parameters.stopSequence.description, personal.general.parameters.stopSequence.label, personal.general.parameters.streamChatResponse.description, personal.general.parameters.streamChatResponse.label, personal.general.parameters.streamDeltaChunkSize.description, personal.general.parameters.streamDeltaChunkSize.label, personal.general.parameters.temperature.description, personal.general.parameters.temperature.label, personal.general.parameters.tfsZ.label, personal.general.parameters.think.label, personal.general.parameters.topK.label, personal.general.parameters.topP.label, personal.general.parameters.useMlock.label, personal.general.parameters.useMmap.label, presence_penalty, reasoning_effort, reasoning_tags, repeat_last_n, repeat_penalty, seed, stop, stream_delta_chunk_size, stream_response, temperature, tfs_z, think, top_k, top_p, use_mlock, use_mmap | P08 |
| SET-044 | src/lib/components/chat/Settings/Advanced/CustomParams.svelte |  | P08 |
| SET-045 | src/lib/components/chat/Settings/ArchivedChats.svelte | personal.archivedChats.exportArchivedChats.label, personal.archivedChats.title, personal.archivedChats.unarchiveAll.label | P08 |
| SET-046 | src/lib/components/chat/Settings/Audio.svelte | audio, audio.stt.engine, audio.tts.engine, audio.tts.voice, conversationMode, personal.audio.allowNonLocalVoices.description, personal.audio.allowNonLocalVoices.label, personal.audio.autoPlaybackResponse.description, personal.audio.autoPlaybackResponse.label, personal.audio.browserVoice.description, personal.audio.browserVoice.label, personal.audio.instantAutoSendAfterVoiceTranscription.description, personal.audio.instantAutoSendAfterVoiceTranscription.label, personal.audio.kokoroJsDtype.description, personal.audio.kokoroJsDtype.label, personal.audio.kokoroVoice.description, personal.audio.kokoroVoice.label, personal.audio.language.description, personal.audio.language.label, personal.audio.sections.sttSettings.title, personal.audio.sections.ttsSettings.title, personal.audio.sections.voice.title, personal.audio.serviceVoice.description, personal.audio.serviceVoice.label, personal.audio.speechPlaybackSpeed.description, personal.audio.speechPlaybackSpeed.label, personal.audio.speechToTextEngine.description, personal.audio.speechToTextEngine.label, personal.audio.textToSpeechEngine.description, personal.audio.textToSpeechEngine.label, personal.audio.title, responseAutoPlayback, speechAutoSend | P15 |
| SET-047 | src/lib/components/chat/Settings/Connections/Connection.svelte | enable | P04 |
| SET-048 | src/lib/components/chat/Settings/Connections.svelte | OPENAI_API_BASE_URLS, OPENAI_API_BASE_URLS.filter, OPENAI_API_BASE_URLS.forEach, OPENAI_API_BASE_URLS.length, OPENAI_API_BASE_URLS.map, OPENAI_API_BASE_URLS.push, OPENAI_API_CONFIGS, OPENAI_API_KEYS, OPENAI_API_KEYS.filter, OPENAI_API_KEYS.length, OPENAI_API_KEYS.push, OPENAI_API_KEYS.slice, directConnections, personal.connections.addConnection.description, personal.connections.addConnection.label, personal.connections.sections.directConnections.title, personal.connections.title | P04 |
| SET-049 | src/lib/components/chat/Settings/DataControls.svelte | personal.dataControls.archiveAll.label, personal.dataControls.archiveAllChats.description, personal.dataControls.archiveAllChats.label, personal.dataControls.deleteAllChats.description, personal.dataControls.deleteAllChats.label, personal.dataControls.exportChats.description, personal.dataControls.exportChats.label, personal.dataControls.importChats.description, personal.dataControls.importChats.label, personal.dataControls.manageFiles.description, personal.dataControls.manageFiles.label, personal.dataControls.sections.chats.title, personal.dataControls.sections.files.title, personal.dataControls.sharedChats.description, personal.dataControls.sharedChats.label, personal.dataControls.title | P08 |
| SET-050 | src/lib/components/chat/Settings/General.svelte | compact_token_threshold, custom_params, features, format, frequency_penalty, function_calling, keep_alive, license_metadata, logit_bias, max_tokens, min_p, mirostat, mirostat_eta, mirostat_tau, num_batch, num_ctx, num_gpu, num_keep, num_thread, params, personal.general.language.description, personal.general.language.label, personal.general.modelParameters.description, personal.general.modelParameters.label, personal.general.sections.advancedParameters.title, personal.general.sections.systemPrompt.description, personal.general.sections.systemPrompt.title, personal.general.sections.webuiSettings.title, personal.general.theme.description, personal.general.theme.label, personal.general.title, presence_penalty, reasoning_effort, reasoning_tags, repeat_last_n, repeat_penalty, seed, stop, stop.split, stream_delta_chunk_size, stream_response, system, temperature, tfs_z, think, top_k, top_p, use_mlock, use_mmap | P08 |
| SET-051 | src/lib/components/chat/Settings/Integrations/Terminals/Connection.svelte |  | P21 |
| SET-052 | src/lib/components/chat/Settings/Integrations/Terminals.svelte | personal.tools.terminals.addConnection.description, personal.tools.terminals.addConnection.label, personal.tools.terminals.sections.openTerminal.title | P21 |
| SET-053 | src/lib/components/chat/Settings/Integrations.svelte | personal.tools.addConnection.description, personal.tools.addConnection.label, personal.tools.sections.externalToolServers.title, personal.tools.title, toolServers | P12 |
| SET-054 | src/lib/components/chat/Settings/Interface/ManageFloatingActionButtonsModal.svelte |  | P08 |
| SET-055 | src/lib/components/chat/Settings/Interface/ManageImageCompressionModal.svelte |  | P08 |
| SET-056 | src/lib/components/chat/Settings/Interface.svelte | personal.interface.title | P08 |
| SET-057 | src/lib/components/chat/Settings/Notifications.svelte | notificationEnabled, notificationSound, personal.notifications.addNotificationTarget.label, personal.notifications.browserNotifications.label, personal.notifications.notificationSound.label, personal.notifications.notificationTargets.label, personal.notifications.title, url_masked | P08 |
| SET-058 | src/lib/components/chat/Settings/Personalization/MemoryModal.svelte |  | P14 |
| SET-059 | src/lib/components/chat/Settings/Personalization.svelte | features, memory, personal.personalization.clearMemory.label, personal.personalization.manageMemories.label, personal.personalization.memory.description, personal.personalization.memory.label, personal.personalization.noResultsFound.description, personal.personalization.savedMemories.label, personal.personalization.sections.memory.title, personal.personalization.title | P14 |
| SET-060 | src/lib/components/chat/Settings/Shortcuts.svelte | keyboardShortcuts, personal.shortcuts.command.label, personal.shortcuts.enableKeyboardShortcuts.description, personal.shortcuts.enableKeyboardShortcuts.label, personal.shortcuts.resetDefaults.label, personal.shortcuts.title | P08 |
| SET-061 | src/lib/components/chat/Settings/SyncStatsModal.svelte |  | P08 |
| SET-062 | src/lib/components/chat/Settings/Tools/Connection.svelte | admin.integrations.mcp.label, admin.integrations.openApi.label, enable, personal.tools.openApi.label | P12 |
| SET-063 | src/lib/components/chat/Settings/Usage.svelte | personal.usage.sections.activity.title, personal.usage.sections.activityInsights.title, personal.usage.sections.mostUsedTools.title, personal.usage.sections.overview.title, personal.usage.sections.topModels.title, personal.usage.title | P08 |
| SET-064 | src/lib/components/chat/Settings/UserSettingField.svelte |  | P08 |
| SET-065 | src/lib/components/chat/Settings/UserSettingRow.svelte |  | P08 |
| SET-066 | src/lib/components/chat/Settings/UserSettingSection.svelte |  | P08 |
| SET-067 | src/lib/components/chat/SettingsModal.svelte | admin.analytics, admin.analytics.title, admin.audio, admin.audio.title, admin.authentication, admin.authentication.title, admin.codeExecution, admin.codeExecution.title, admin.connections, admin.connections.title, admin.db, admin.db.title, admin.documents, admin.documents.title, admin.evaluations, admin.evaluations.title, admin.general, admin.general.title, admin.images, admin.images.title, admin.integrations, admin.integrations.title, admin.interface, admin.interface.title, admin.models, admin.models.title, admin.pipelines, admin.pipelines.title, admin.subagents, admin.subagents.title, admin.web, admin.web.title, directConnections, features, interface, personal.about, personal.about.title, personal.account, personal.account.title, personal.archivedChats, personal.archivedChats.title, personal.audio, personal.audio.title, personal.connections, personal.connections.title, personal.dataControls, personal.dataControls.title, personal.general, personal.general.parameters, personal.general.title, personal.interface, personal.interface.title, personal.notifications, personal.notifications.title, personal.personalization, personal.personalization.title, personal.shortcuts, personal.shortcuts.title, personal.tools, personal.tools.title, personal.usage, personal.usage.title, set, ui | P08 |

## Locale coverage

| Locale | Source |
|---|---|
| ar | src/lib/i18n/locales/ar/translation.json |
| ar-BH | src/lib/i18n/locales/ar-BH/translation.json |
| az-AZ | src/lib/i18n/locales/az-AZ/translation.json |
| bg-BG | src/lib/i18n/locales/bg-BG/translation.json |
| bn-BD | src/lib/i18n/locales/bn-BD/translation.json |
| bo-TB | src/lib/i18n/locales/bo-TB/translation.json |
| bs-BA | src/lib/i18n/locales/bs-BA/translation.json |
| ca-ES | src/lib/i18n/locales/ca-ES/translation.json |
| ceb-PH | src/lib/i18n/locales/ceb-PH/translation.json |
| cs-CZ | src/lib/i18n/locales/cs-CZ/translation.json |
| da-DK | src/lib/i18n/locales/da-DK/translation.json |
| de-DE | src/lib/i18n/locales/de-DE/translation.json |
| dg-DG | src/lib/i18n/locales/dg-DG/translation.json |
| el-GR | src/lib/i18n/locales/el-GR/translation.json |
| en-GB | src/lib/i18n/locales/en-GB/translation.json |
| en-US | src/lib/i18n/locales/en-US/translation.json |
| es-ES | src/lib/i18n/locales/es-ES/translation.json |
| et-EE | src/lib/i18n/locales/et-EE/translation.json |
| eu-ES | src/lib/i18n/locales/eu-ES/translation.json |
| fa-IR | src/lib/i18n/locales/fa-IR/translation.json |
| fi-FI | src/lib/i18n/locales/fi-FI/translation.json |
| fil-PH | src/lib/i18n/locales/fil-PH/translation.json |
| fo-FO | src/lib/i18n/locales/fo-FO/translation.json |
| fr-CA | src/lib/i18n/locales/fr-CA/translation.json |
| fr-FR | src/lib/i18n/locales/fr-FR/translation.json |
| gl-ES | src/lib/i18n/locales/gl-ES/translation.json |
| he-IL | src/lib/i18n/locales/he-IL/translation.json |
| hi-IN | src/lib/i18n/locales/hi-IN/translation.json |
| hr-HR | src/lib/i18n/locales/hr-HR/translation.json |
| hu-HU | src/lib/i18n/locales/hu-HU/translation.json |
| id-ID | src/lib/i18n/locales/id-ID/translation.json |
| ie-GA | src/lib/i18n/locales/ie-GA/translation.json |
| it-IT | src/lib/i18n/locales/it-IT/translation.json |
| ja-JP | src/lib/i18n/locales/ja-JP/translation.json |
| ka-GE | src/lib/i18n/locales/ka-GE/translation.json |
| kab-DZ | src/lib/i18n/locales/kab-DZ/translation.json |
| ko-KR | src/lib/i18n/locales/ko-KR/translation.json |
| lt-LT | src/lib/i18n/locales/lt-LT/translation.json |
| lv-LV | src/lib/i18n/locales/lv-LV/translation.json |
| ms-MY | src/lib/i18n/locales/ms-MY/translation.json |
| nb-NO | src/lib/i18n/locales/nb-NO/translation.json |
| nl-NL | src/lib/i18n/locales/nl-NL/translation.json |
| pa-IN | src/lib/i18n/locales/pa-IN/translation.json |
| pl-PL | src/lib/i18n/locales/pl-PL/translation.json |
| pt-BR | src/lib/i18n/locales/pt-BR/translation.json |
| pt-PT | src/lib/i18n/locales/pt-PT/translation.json |
| ro-RO | src/lib/i18n/locales/ro-RO/translation.json |
| ru-RU | src/lib/i18n/locales/ru-RU/translation.json |
| sk-SK | src/lib/i18n/locales/sk-SK/translation.json |
| sl-SI | src/lib/i18n/locales/sl-SI/translation.json |
| sr-RS | src/lib/i18n/locales/sr-RS/translation.json |
| sv-SE | src/lib/i18n/locales/sv-SE/translation.json |
| ta-IN | src/lib/i18n/locales/ta-IN/translation.json |
| th-TH | src/lib/i18n/locales/th-TH/translation.json |
| tk-TM | src/lib/i18n/locales/tk-TM/translation.json |
| tr-TR | src/lib/i18n/locales/tr-TR/translation.json |
| ug-CN | src/lib/i18n/locales/ug-CN/translation.json |
| uk-UA | src/lib/i18n/locales/uk-UA/translation.json |
| ur-PK | src/lib/i18n/locales/ur-PK/translation.json |
| uz-Cyrl-UZ | src/lib/i18n/locales/uz-Cyrl-UZ/translation.json |
| uz-Latn-UZ | src/lib/i18n/locales/uz-Latn-UZ/translation.json |
| vi-VN | src/lib/i18n/locales/vi-VN/translation.json |
| zh-CN | src/lib/i18n/locales/zh-CN/translation.json |
| zh-TW | src/lib/i18n/locales/zh-TW/translation.json |

## Integration adapter catalogue

| ID | Integration | Owner | Source |
|---|---|---|---|
| INT-001 | datalab_marker | P09 | backend/open_webui/retrieval/loaders/datalab_marker.py |
| INT-002 | external_document | P09 | backend/open_webui/retrieval/loaders/external_document.py |
| INT-003 | external_web | P09 | backend/open_webui/retrieval/loaders/external_web.py |
| INT-004 | local | P09 | backend/open_webui/retrieval/loaders/local.py |
| INT-005 | main | P09 | backend/open_webui/retrieval/loaders/main.py |
| INT-006 | microsoft_web_iq | P09 | backend/open_webui/retrieval/loaders/microsoft_web_iq.py |
| INT-007 | mineru | P09 | backend/open_webui/retrieval/loaders/mineru.py |
| INT-008 | mistral | P09 | backend/open_webui/retrieval/loaders/mistral.py |
| INT-009 | paddleocr_vl | P09 | backend/open_webui/retrieval/loaders/paddleocr_vl.py |
| INT-010 | pdf | P09 | backend/open_webui/retrieval/loaders/pdf.py |
| INT-011 | tavily | P09 | backend/open_webui/retrieval/loaders/tavily.py |
| INT-012 | youtube | P09 | backend/open_webui/retrieval/loaders/youtube.py |
| INT-013 | chroma | P13 | backend/open_webui/retrieval/vector/dbs/chroma.py |
| INT-014 | elasticsearch | P13 | backend/open_webui/retrieval/vector/dbs/elasticsearch.py |
| INT-015 | mariadb_vector | P13 | backend/open_webui/retrieval/vector/dbs/mariadb_vector.py |
| INT-016 | milvus | P13 | backend/open_webui/retrieval/vector/dbs/milvus.py |
| INT-017 | milvus_multitenancy | P13 | backend/open_webui/retrieval/vector/dbs/milvus_multitenancy.py |
| INT-018 | opengauss | P13 | backend/open_webui/retrieval/vector/dbs/opengauss.py |
| INT-019 | opensearch | P13 | backend/open_webui/retrieval/vector/dbs/opensearch.py |
| INT-020 | oracle23ai | P13 | backend/open_webui/retrieval/vector/dbs/oracle23ai.py |
| INT-021 | pgvector | P13 | backend/open_webui/retrieval/vector/dbs/pgvector.py |
| INT-022 | pinecone | P13 | backend/open_webui/retrieval/vector/dbs/pinecone.py |
| INT-023 | qdrant | P13 | backend/open_webui/retrieval/vector/dbs/qdrant.py |
| INT-024 | qdrant_multitenancy | P13 | backend/open_webui/retrieval/vector/dbs/qdrant_multitenancy.py |
| INT-025 | s3vector | P13 | backend/open_webui/retrieval/vector/dbs/s3vector.py |
| INT-026 | valkey | P13 | backend/open_webui/retrieval/vector/dbs/valkey.py |
| INT-027 | weaviate | P13 | backend/open_webui/retrieval/vector/dbs/weaviate.py |
| INT-028 | azure | P14 | backend/open_webui/retrieval/web/azure.py |
| INT-029 | bing | P14 | backend/open_webui/retrieval/web/bing.py |
| INT-030 | bocha | P14 | backend/open_webui/retrieval/web/bocha.py |
| INT-031 | brave | P14 | backend/open_webui/retrieval/web/brave.py |
| INT-032 | brave_llm_context | P14 | backend/open_webui/retrieval/web/brave_llm_context.py |
| INT-033 | duckduckgo | P14 | backend/open_webui/retrieval/web/duckduckgo.py |
| INT-034 | exa | P14 | backend/open_webui/retrieval/web/exa.py |
| INT-035 | external | P14 | backend/open_webui/retrieval/web/external.py |
| INT-036 | firecrawl | P14 | backend/open_webui/retrieval/web/firecrawl.py |
| INT-037 | google_pse | P14 | backend/open_webui/retrieval/web/google_pse.py |
| INT-038 | jina_search | P14 | backend/open_webui/retrieval/web/jina_search.py |
| INT-039 | kagi | P14 | backend/open_webui/retrieval/web/kagi.py |
| INT-040 | linkup | P14 | backend/open_webui/retrieval/web/linkup.py |
| INT-041 | main | P14 | backend/open_webui/retrieval/web/main.py |
| INT-042 | microsoft_web_iq | P14 | backend/open_webui/retrieval/web/microsoft_web_iq.py |
| INT-043 | mojeek | P14 | backend/open_webui/retrieval/web/mojeek.py |
| INT-044 | ollama | P14 | backend/open_webui/retrieval/web/ollama.py |
| INT-045 | openserp | P14 | backend/open_webui/retrieval/web/openserp.py |
| INT-046 | perplexity | P14 | backend/open_webui/retrieval/web/perplexity.py |
| INT-047 | perplexity_search | P14 | backend/open_webui/retrieval/web/perplexity_search.py |
| INT-048 | searchapi | P14 | backend/open_webui/retrieval/web/searchapi.py |
| INT-049 | searxng | P14 | backend/open_webui/retrieval/web/searxng.py |
| INT-050 | serpapi | P14 | backend/open_webui/retrieval/web/serpapi.py |
| INT-051 | serper | P14 | backend/open_webui/retrieval/web/serper.py |
| INT-052 | serphouse | P14 | backend/open_webui/retrieval/web/serphouse.py |
| INT-053 | serply | P14 | backend/open_webui/retrieval/web/serply.py |
| INT-054 | serpstack | P14 | backend/open_webui/retrieval/web/serpstack.py |
| INT-055 | sougou | P14 | backend/open_webui/retrieval/web/sougou.py |
| INT-056 | staan | P14 | backend/open_webui/retrieval/web/staan.py |
| INT-057 | tavily | P14 | backend/open_webui/retrieval/web/tavily.py |
| INT-058 | utils | P14 | backend/open_webui/retrieval/web/utils.py |
| INT-059 | yacy | P14 | backend/open_webui/retrieval/web/yacy.py |
| INT-060 | yandex | P14 | backend/open_webui/retrieval/web/yandex.py |
| INT-061 | ydc | P14 | backend/open_webui/retrieval/web/ydc.py |
| INT-062 | provider | P09 | backend/open_webui/storage/provider.py |
| INT-063 | client | P12 | backend/open_webui/utils/mcp/client.py |
