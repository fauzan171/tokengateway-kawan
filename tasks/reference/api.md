# Baseline inventory Open WebUI

Commit `f8ae8a6c328946dc62cd0712961a0632574581bf`. Metadata hasil scan, bukan source code aplikasi. Seluruh row masuk target planning; status perilaku belum diverifikasi.


## HTTP/WS endpoints

Handler names/signatures and request shapes are metadata, not behavior proof. Resolve dynamic decorators, router mounts and response/status branches in P00/P24; unmounted rows remain in scope until classified with evidence. Full argument descriptors in inventory.json.

| ID | Method | Path(s) | Handler | Owner | Source |
|---|---|---|---|---|---|
| API-0001 | GET | /api/models | get_models | P10 | backend/open_webui/main.py:927 |
| API-0002 | GET | /api/v1/models | get_models | P10 | backend/open_webui/main.py:927 |
| API-0003 | GET | /api/models/base | get_base_models | P23 | backend/open_webui/main.py:975 |
| API-0004 | POST | /api/models/unload | unload_model | P23 | backend/open_webui/main.py:985 |
| API-0005 | POST | /api/embeddings | embeddings | P00 | backend/open_webui/main.py:1104 |
| API-0006 | POST | /api/v1/embeddings | embeddings | P00 | backend/open_webui/main.py:1104 |
| API-0007 | POST | /api/chat/completions | chat_completion | P05 | backend/open_webui/main.py:1140 |
| API-0008 | POST | /api/v1/chat/completions | chat_completion | P05 | backend/open_webui/main.py:1140 |
| API-0009 | POST | /api/v1/chats/{id}/messages/{message_id}/resolve | resolve_chat_message_tool_call | P07 | backend/open_webui/main.py:1914 |
| API-0010 | POST | /api/message/count_tokens | count_message_tokens | P00 | backend/open_webui/main.py:1961 |
| API-0011 | POST | /api/v1/messages/count_tokens | count_message_tokens | P00 | backend/open_webui/main.py:1961 |
| API-0012 | POST | /api/message | generate_messages | P00 | backend/open_webui/main.py:2033 |
| API-0013 | POST | /api/v1/messages | generate_messages | P00 | backend/open_webui/main.py:2033 |
| API-0014 | POST | /api/chat/completed | chat_completed | P05 | backend/open_webui/main.py:2120 |
| API-0015 | POST | /api/chat/actions/{action_id} | chat_action | P05 | backend/open_webui/main.py:2140 |
| API-0016 | POST | /api/tasks/stop/{task_id} | stop_task_endpoint | P00 | backend/open_webui/main.py:2158 |
| API-0017 | GET | /api/tasks | list_tasks_endpoint | P00 | backend/open_webui/main.py:2167 |
| API-0018 | GET | /api/tasks/chat/{chat_id:path} | list_tasks_by_chat_id_endpoint | P05 | backend/open_webui/main.py:2172 |
| API-0019 | POST | /api/tasks/chat/{chat_id:path}/stop | stop_tasks_by_chat_id_endpoint | P05 | backend/open_webui/main.py:2193 |
| API-0020 | GET | /api/config | get_app_config | P00 | backend/open_webui/main.py:2267 |
| API-0021 | GET | /api/events | get_event_catalog | P00 | backend/open_webui/main.py:2564 |
| API-0022 | GET | /api/events/webhooks | get_event_webhooks_api | P00 | backend/open_webui/main.py:2572 |
| API-0023 | POST | /api/events/webhooks | create_event_webhook | P00 | backend/open_webui/main.py:2577 |
| API-0024 | PUT | /api/events/webhooks/{webhook_id} | update_event_webhook | P00 | backend/open_webui/main.py:2608 |
| API-0025 | DELETE | /api/events/webhooks/{webhook_id} | delete_event_webhook_api | P00 | backend/open_webui/main.py:2642 |
| API-0026 | GET | /api/version | get_app_version | P00 | backend/open_webui/main.py:2659 |
| API-0027 | GET | /api/version/updates | get_app_latest_release_version | P00 | backend/open_webui/main.py:2667 |
| API-0028 | GET | /api/changelog | get_app_changelog | P00 | backend/open_webui/main.py:2689 |
| API-0029 | GET | /api/usage | get_current_usage | P00 | backend/open_webui/main.py:2694 |
| API-0030 | GET | /oauth/clients/{client_id}/authorize | oauth_client_authorize | P02 | backend/open_webui/main.py:2848 |
| API-0031 | GET | /oauth/clients/{client_id}/callback | oauth_client_callback | P02 | backend/open_webui/main.py:2894 |
| API-0032 | GET | /oauth/{provider}/login | oauth_login | P02 | backend/open_webui/main.py:2910 |
| API-0033 | GET | /oauth/{provider}/login/callback | oauth_login_callback | P02 | backend/open_webui/main.py:2916 |
| API-0034 | GET | /oauth/{provider}/callback | oauth_login_callback | P02 | backend/open_webui/main.py:2916 |
| API-0035 | POST | /oauth/backchannel-logout | oauth_backchannel_logout | P02 | backend/open_webui/main.py:2940 |
| API-0036 | GET | /manifest.json | get_manifest_json | P00 | backend/open_webui/main.py:2950 |
| API-0037 | GET | /opensearch.xml | get_opensearch_xml | P00 | backend/open_webui/main.py:3002 |
| API-0038 | GET | /health | healthcheck | P00 | backend/open_webui/main.py:3045 |
| API-0039 | GET | /ready | readiness_check | P00 | backend/open_webui/main.py:3050 |
| API-0040 | GET | /health/db | check_db_health | P00 | backend/open_webui/main.py:3091 |
| API-0041 | GET | /cache/{path:path} | serve_cache_file | P00 | backend/open_webui/main.py:3108 |
| API-0042 | GET | /api/v1/analytics/models | get_model_analytics | P22 | backend/open_webui/routers/analytics.py:59 |
| API-0043 | GET | /api/v1/analytics/users | get_user_analytics | P22 | backend/open_webui/routers/analytics.py:86 |
| API-0044 | GET | /api/v1/analytics/messages | get_messages | P22 | backend/open_webui/routers/analytics.py:126 |
| API-0045 | GET | /api/v1/analytics/summary | get_summary | P22 | backend/open_webui/routers/analytics.py:164 |
| API-0046 | GET | /api/v1/analytics/daily | get_daily_stats | P22 | backend/open_webui/routers/analytics.py:200 |
| API-0047 | GET | /api/v1/analytics/tokens | get_token_usage | P22 | backend/open_webui/routers/analytics.py:238 |
| API-0048 | GET | /api/v1/analytics/models/{model_id:path}/chats | get_model_chats | P22 | backend/open_webui/routers/analytics.py:288 |
| API-0049 | GET | /api/v1/analytics/models/{model_id:path}/overview | get_model_overview | P22 | backend/open_webui/routers/analytics.py:346 |
| API-0050 | GET | /api/v1/audio/config | get_audio_config | P15 | backend/open_webui/routers/audio/__init__.py:311 |
| API-0051 | POST | /api/v1/audio/config/update | update_audio_config | P15 | backend/open_webui/routers/audio/__init__.py:320 |
| API-0052 | POST | /api/v1/audio/speech | speech | P15 | backend/open_webui/routers/audio/__init__.py:757 |
| API-0053 | POST | /api/v1/audio/transcriptions | transcription | P15 | backend/open_webui/routers/audio/__init__.py:1451 |
| API-0054 | GET | /api/v1/audio/models | get_models | P15 | backend/open_webui/routers/audio/__init__.py:1607 |
| API-0055 | GET | /api/v1/audio/voices | get_voices | P15 | backend/open_webui/routers/audio/__init__.py:1718 |
| API-0056 | WEBSOCKET | /api/v1/audio/realtime | realtime_call | P15 | backend/open_webui/routers/audio/realtime.py:326 |
| API-0057 | GET | /api/v1/auths/ | get_session_user | P02 | backend/open_webui/routers/auths.py:173 |
| API-0058 | POST | /api/v1/auths/update/profile | update_profile | P02 | backend/open_webui/routers/auths.py:243 |
| API-0059 | POST | /api/v1/auths/update/timezone | update_timezone | P02 | backend/open_webui/routers/auths.py:280 |
| API-0060 | POST | /api/v1/auths/update/password | update_password | P02 | backend/open_webui/routers/auths.py:310 |
| API-0061 | POST | /api/v1/auths/ldap | ldap_auth | P02 | backend/open_webui/routers/auths.py:405 |
| API-0062 | POST | /api/v1/auths/signin | signin | P02 | backend/open_webui/routers/auths.py:653 |
| API-0063 | POST | /api/v1/auths/signup | signup | P02 | backend/open_webui/routers/auths.py:844 |
| API-0064 | POST | /api/v1/auths/signout | signout | P02 | backend/open_webui/routers/auths.py:900 |
| API-0065 | DELETE | /api/v1/auths/oauth/sessions/{provider:path} | delete_oauth_session_by_provider | P02 | backend/open_webui/routers/auths.py:1012 |
| API-0066 | POST | /api/v1/auths/add | add_user | P02 | backend/open_webui/routers/auths.py:1046 |
| API-0067 | GET | /api/v1/auths/admin/details | get_admin_details | P02 | backend/open_webui/routers/auths.py:1121 |
| API-0068 | GET | /api/v1/auths/admin/config | get_admin_config | P02 | backend/open_webui/routers/auths.py:1154 |
| API-0069 | POST | /api/v1/auths/admin/config | update_admin_config | P02 | backend/open_webui/routers/auths.py:1219 |
| API-0070 | GET | /api/v1/auths/admin/config/ldap/server | get_ldap_server | P02 | backend/open_webui/routers/auths.py:1271 |
| API-0071 | POST | /api/v1/auths/admin/config/ldap/server | update_ldap_server | P02 | backend/open_webui/routers/auths.py:1276 |
| API-0072 | GET | /api/v1/auths/admin/config/ldap | get_ldap_config | P02 | backend/open_webui/routers/auths.py:1302 |
| API-0073 | POST | /api/v1/auths/admin/config/ldap | update_ldap_config | P02 | backend/open_webui/routers/auths.py:1311 |
| API-0074 | GET | /api/v1/auths/admin/config/oauth | get_oauth_config | P02 | backend/open_webui/routers/auths.py:1459 |
| API-0075 | POST | /api/v1/auths/admin/config/oauth | update_oauth_config | P02 | backend/open_webui/routers/auths.py:1464 |
| API-0076 | POST | /api/v1/auths/api_key | generate_api_key | P02 | backend/open_webui/routers/auths.py:1482 |
| API-0077 | DELETE | /api/v1/auths/api_key | delete_api_key | P02 | backend/open_webui/routers/auths.py:1507 |
| API-0078 | GET | /api/v1/auths/api_key | get_api_key | P02 | backend/open_webui/routers/auths.py:1525 |
| API-0079 | POST | /api/v1/auths/oauth/{provider}/token/exchange | token_exchange | P02 | backend/open_webui/routers/auths.py:1577 |
| API-0080 | GET | /api/v1/automations/list | get_automation_items | P20 | backend/open_webui/routers/automations.py:163 |
| API-0081 | POST | /api/v1/automations/create | create_new_automation | P20 | backend/open_webui/routers/automations.py:209 |
| API-0082 | GET | /api/v1/automations/{id} | get_automation_by_id | P20 | backend/open_webui/routers/automations.py:247 |
| API-0083 | POST | /api/v1/automations/{id}/update | update_automation_by_id | P20 | backend/open_webui/routers/automations.py:265 |
| API-0084 | POST | /api/v1/automations/{id}/toggle | toggle_automation_by_id | P20 | backend/open_webui/routers/automations.py:307 |
| API-0085 | POST | /api/v1/automations/{id}/run | run_automation_by_id | P20 | backend/open_webui/routers/automations.py:335 |
| API-0086 | DELETE | /api/v1/automations/{id}/delete | delete_automation_by_id | P20 | backend/open_webui/routers/automations.py:362 |
| API-0087 | GET | /api/v1/automations/{id}/runs | get_automation_runs | P20 | backend/open_webui/routers/automations.py:390 |
| API-0088 | GET | /api/v1/calendars/ | get_calendars | P19 | backend/open_webui/routers/calendar.py:89 |
| API-0089 | POST | /api/v1/calendars/create | create_calendar | P19 | backend/open_webui/routers/calendar.py:114 |
| API-0090 | GET | /api/v1/calendars/events | get_events | P19 | backend/open_webui/routers/calendar.py:145 |
| API-0091 | POST | /api/v1/calendars/events/create | create_event | P19 | backend/open_webui/routers/calendar.py:283 |
| API-0092 | GET | /api/v1/calendars/events/search | search_events | P19 | backend/open_webui/routers/calendar.py:301 |
| API-0093 | GET | /api/v1/calendars/events/{event_id} | get_event | P19 | backend/open_webui/routers/calendar.py:313 |
| API-0094 | POST | /api/v1/calendars/events/{event_id}/update | update_event | P19 | backend/open_webui/routers/calendar.py:325 |
| API-0095 | DELETE | /api/v1/calendars/events/{event_id}/delete | delete_event | P19 | backend/open_webui/routers/calendar.py:358 |
| API-0096 | POST | /api/v1/calendars/events/{event_id}/rsvp | rsvp_event | P19 | backend/open_webui/routers/calendar.py:380 |
| API-0097 | GET | /api/v1/calendars/{calendar_id} | get_calendar_by_id | P19 | backend/open_webui/routers/calendar.py:407 |
| API-0098 | POST | /api/v1/calendars/{calendar_id}/update | update_calendar | P19 | backend/open_webui/routers/calendar.py:414 |
| API-0099 | DELETE | /api/v1/calendars/{calendar_id}/delete | delete_calendar | P19 | backend/open_webui/routers/calendar.py:452 |
| API-0100 | POST | /api/v1/calendars/{calendar_id}/default | set_default_calendar | P19 | backend/open_webui/routers/calendar.py:483 |
| API-0101 | GET | /api/v1/channels/ | get_channels | P17 | backend/open_webui/routers/channels.py:174 |
| API-0102 | GET | /api/v1/channels/list | get_all_channels | P17 | backend/open_webui/routers/channels.py:223 |
| API-0103 | GET | /api/v1/channels/users/{user_id} | get_dm_channel_by_user_id | P17 | backend/open_webui/routers/channels.py:240 |
| API-0104 | POST | /api/v1/channels/create | create_new_channel | P17 | backend/open_webui/routers/channels.py:298 |
| API-0105 | GET | /api/v1/channels/{id} | get_channel_by_id | P17 | backend/open_webui/routers/channels.py:386 |
| API-0106 | GET | /api/v1/channels/{id}/members | get_channel_members_by_id | P17 | backend/open_webui/routers/channels.py:515 |
| API-0107 | POST | /api/v1/channels/{id}/members/active | update_is_active_member_by_id_and_user_id | P17 | backend/open_webui/routers/channels.py:593 |
| API-0108 | POST | /api/v1/channels/{id}/update/members/add | add_members_by_id | P17 | backend/open_webui/routers/channels.py:630 |
| API-0109 | POST | /api/v1/channels/{id}/update/members/remove | remove_members_by_id | P17 | backend/open_webui/routers/channels.py:684 |
| API-0110 | POST | /api/v1/channels/{id}/update | update_channel_by_id | P17 | backend/open_webui/routers/channels.py:727 |
| API-0111 | DELETE | /api/v1/channels/{id}/delete | delete_channel_by_id | P17 | backend/open_webui/routers/channels.py:782 |
| API-0112 | GET | /api/v1/channels/{id}/messages | get_channel_messages | P17 | backend/open_webui/routers/channels.py:832 |
| API-0113 | GET | /api/v1/channels/{id}/messages/pinned | get_pinned_channel_messages | P17 | backend/open_webui/routers/channels.py:900 |
| API-0114 | POST | /api/v1/channels/{id}/messages/post | post_new_message | P17 | backend/open_webui/routers/channels.py:1245 |
| API-0115 | GET | /api/v1/channels/{id}/messages/{message_id} | get_channel_message | P17 | backend/open_webui/routers/channels.py:1307 |
| API-0116 | GET | /api/v1/channels/{id}/messages/{message_id}/data | get_channel_message_data | P17 | backend/open_webui/routers/channels.py:1348 |
| API-0117 | POST | /api/v1/channels/{id}/messages/{message_id}/pin | pin_channel_message | P17 | backend/open_webui/routers/channels.py:1387 |
| API-0118 | GET | /api/v1/channels/{id}/messages/{message_id}/thread | get_channel_thread_messages | P17 | backend/open_webui/routers/channels.py:1461 |
| API-0119 | POST | /api/v1/channels/{id}/messages/{message_id}/update | update_message_by_id | P17 | backend/open_webui/routers/channels.py:1523 |
| API-0120 | POST | /api/v1/channels/{id}/messages/{message_id}/reactions/add | add_reaction_to_message | P17 | backend/open_webui/routers/channels.py:1601 |
| API-0121 | POST | /api/v1/channels/{id}/messages/{message_id}/reactions/remove | remove_reaction_by_id_and_user_id_and_name | P17 | backend/open_webui/routers/channels.py:1675 |
| API-0122 | DELETE | /api/v1/channels/{id}/messages/{message_id}/delete | delete_message_by_id | P17 | backend/open_webui/routers/channels.py:1750 |
| API-0123 | GET | /api/v1/channels/webhooks/{webhook_id}/profile/image | get_webhook_profile_image | P17 | backend/open_webui/routers/channels.py:1847 |
| API-0124 | GET | /api/v1/channels/{id}/webhooks | get_channel_webhooks | P17 | backend/open_webui/routers/channels.py:1906 |
| API-0125 | POST | /api/v1/channels/{id}/webhooks/create | create_channel_webhook | P17 | backend/open_webui/routers/channels.py:1925 |
| API-0126 | POST | /api/v1/channels/{id}/webhooks/{webhook_id}/update | update_channel_webhook | P17 | backend/open_webui/routers/channels.py:1956 |
| API-0127 | DELETE | /api/v1/channels/{id}/webhooks/{webhook_id}/delete | delete_channel_webhook | P17 | backend/open_webui/routers/channels.py:1992 |
| API-0128 | POST | /api/v1/channels/webhooks/{webhook_id}/{token} | post_webhook_message | P17 | backend/open_webui/routers/channels.py:2034 |
| API-0129 | GET | /api/v1/chats/ | get_session_user_chat_list | P06 | backend/open_webui/routers/chats.py:295 |
| API-0130 | GET | /api/v1/chats/list | get_session_user_chat_list | P06 | backend/open_webui/routers/chats.py:295 |
| API-0131 | POST | /api/v1/chats/read | mark_chats_read_by_user_id | P06 | backend/open_webui/routers/chats.py:336 |
| API-0132 | GET | /api/v1/chats/stats/usage | get_session_user_chat_usage_stats | P06 | backend/open_webui/routers/chats.py:353 |
| API-0133 | GET | /api/v1/chats/stats/export | export_chat_stats | P06 | backend/open_webui/routers/chats.py:655 |
| API-0134 | GET | /api/v1/chats/stats/export/{chat_id} | export_single_chat_stats | P06 | backend/open_webui/routers/chats.py:701 |
| API-0135 | DELETE | /api/v1/chats/ | delete_all_user_chats | P06 | backend/open_webui/routers/chats.py:753 |
| API-0136 | GET | /api/v1/chats/list/user/{user_id} | get_user_chat_list_by_user_id | P06 | backend/open_webui/routers/chats.py:784 |
| API-0137 | POST | /api/v1/chats/new | create_new_chat | P06 | backend/open_webui/routers/chats.py:822 |
| API-0138 | POST | /api/v1/chats/import | import_chats | P06 | backend/open_webui/routers/chats.py:857 |
| API-0139 | GET | /api/v1/chats/config | get_chat_config | P06 | backend/open_webui/routers/chats.py:888 |
| API-0140 | POST | /api/v1/chats/config | set_chat_config | P06 | backend/open_webui/routers/chats.py:893 |
| API-0141 | GET | /api/v1/chats/search | search_user_chats | P06 | backend/open_webui/routers/chats.py:927 |
| API-0142 | GET | /api/v1/chats/folder/{folder_id} | get_chats_by_folder_id | P06 | backend/open_webui/routers/chats.py:974 |
| API-0143 | GET | /api/v1/chats/folder/{folder_id}/list | get_chat_list_by_folder_id | P06 | backend/open_webui/routers/chats.py:989 |
| API-0144 | GET | /api/v1/chats/pinned | get_user_pinned_chats | P06 | backend/open_webui/routers/chats.py:1024 |
| API-0145 | GET | /api/v1/chats/all | get_user_chats | P06 | backend/open_webui/routers/chats.py:1070 |
| API-0146 | GET | /api/v1/chats/all/archived | get_user_archived_chats | P06 | backend/open_webui/routers/chats.py:1083 |
| API-0147 | GET | /api/v1/chats/all/tags | get_all_user_tags | P06 | backend/open_webui/routers/chats.py:1096 |
| API-0148 | GET | /api/v1/chats/all/db | get_all_user_chats_in_db | P06 | backend/open_webui/routers/chats.py:1111 |
| API-0149 | GET | /api/v1/chats/archived | get_archived_session_user_chat_list | P06 | backend/open_webui/routers/chats.py:1123 |
| API-0150 | GET | /api/v1/chats/archived/count | get_archived_session_user_chat_count | P06 | backend/open_webui/routers/chats.py:1162 |
| API-0151 | POST | /api/v1/chats/archive/all | archive_all_chats | P06 | backend/open_webui/routers/chats.py:1175 |
| API-0152 | POST | /api/v1/chats/unarchive/all | unarchive_all_chats | P06 | backend/open_webui/routers/chats.py:1190 |
| API-0153 | DELETE | /api/v1/chats/share/all | unshare_all_chats | P06 | backend/open_webui/routers/chats.py:1211 |
| API-0154 | GET | /api/v1/chats/shared | get_shared_session_user_chat_list | P06 | backend/open_webui/routers/chats.py:1239 |
| API-0155 | GET | /api/v1/chats/share/{share_id} | get_shared_chat_by_id | P06 | backend/open_webui/routers/chats.py:1276 |
| API-0156 | POST | /api/v1/chats/tags | get_user_chat_list_by_tag_name | P06 | backend/open_webui/routers/chats.py:1335 |
| API-0157 | POST | /api/v1/chats/{id}/compact | compact_chat_by_id | P06 | backend/open_webui/routers/chats.py:1356 |
| API-0158 | GET | /api/v1/chats/{id} | get_chat_by_id | P06 | backend/open_webui/routers/chats.py:1410 |
| API-0159 | POST | /api/v1/chats/{id} | update_chat_by_id | P06 | backend/open_webui/routers/chats.py:1445 |
| API-0160 | POST | /api/v1/chats/{id}/messages/{message_id} | update_chat_message_by_id | P06 | backend/open_webui/routers/chats.py:1491 |
| API-0161 | DELETE | /api/v1/chats/{id}/messages/{message_id} | delete_chat_message_by_id | P06 | backend/open_webui/routers/chats.py:1558 |
| API-0162 | POST | /api/v1/chats/{id}/messages/{message_id}/event | send_chat_message_event_by_id | P06 | backend/open_webui/routers/chats.py:1605 |
| API-0163 | DELETE | /api/v1/chats/{id} | delete_chat_by_id | P06 | backend/open_webui/routers/chats.py:1658 |
| API-0164 | GET | /api/v1/chats/{id}/pinned | get_pinned_status_by_id | P06 | backend/open_webui/routers/chats.py:1716 |
| API-0165 | POST | /api/v1/chats/{id}/pin | pin_chat_by_id | P06 | backend/open_webui/routers/chats.py:1732 |
| API-0166 | POST | /api/v1/chats/{id}/fork | fork_chat_by_id | P06 | backend/open_webui/routers/chats.py:1764 |
| API-0167 | POST | /api/v1/chats/{id}/clone | clone_chat_by_id | P06 | backend/open_webui/routers/chats.py:1879 |
| API-0168 | POST | /api/v1/chats/{id}/clone/shared | clone_shared_chat_by_id | P06 | backend/open_webui/routers/chats.py:1938 |
| API-0169 | POST | /api/v1/chats/{id}/archive | archive_chat_by_id | P06 | backend/open_webui/routers/chats.py:2015 |
| API-0170 | POST | /api/v1/chats/{id}/share | share_chat_by_id | P06 | backend/open_webui/routers/chats.py:2049 |
| API-0171 | DELETE | /api/v1/chats/{id}/share | delete_shared_chat_by_id | P06 | backend/open_webui/routers/chats.py:2100 |
| API-0172 | POST | /api/v1/chats/shared/{id}/access/update | update_shared_chat_access_by_id | P06 | backend/open_webui/routers/chats.py:2135 |
| API-0173 | GET | /api/v1/chats/shared/{id}/access | get_shared_chat_access_by_id | P06 | backend/open_webui/routers/chats.py:2178 |
| API-0174 | POST | /api/v1/chats/{id}/unread | mark_chat_unread_by_id | P06 | backend/open_webui/routers/chats.py:2215 |
| API-0175 | POST | /api/v1/chats/{id}/folder | update_chat_folder_id_by_id | P06 | backend/open_webui/routers/chats.py:2237 |
| API-0176 | GET | /api/v1/chats/{id}/tags | get_chat_tags_by_id | P06 | backend/open_webui/routers/chats.py:2272 |
| API-0177 | POST | /api/v1/chats/{id}/tags | add_tag_by_id_and_tag_name | P06 | backend/open_webui/routers/chats.py:2292 |
| API-0178 | DELETE | /api/v1/chats/{id}/tags | delete_tag_by_id_and_tag_name | P06 | backend/open_webui/routers/chats.py:2333 |
| API-0179 | POST | /api/v1/configs/import | import_config | P23 | backend/open_webui/routers/configs.py:101 |
| API-0180 | GET | /api/v1/configs/export | export_config | P23 | backend/open_webui/routers/configs.py:121 |
| API-0181 | GET | /api/v1/configs/namespace/{namespace} | get_config_namespace | P23 | backend/open_webui/routers/configs.py:126 |
| API-0182 | GET | /api/v1/configs/connections | get_connections_config | P23 | backend/open_webui/routers/configs.py:142 |
| API-0183 | POST | /api/v1/configs/connections | set_connections_config | P23 | backend/open_webui/routers/configs.py:147 |
| API-0184 | POST | /api/v1/configs/oauth/clients/register | register_oauth_client | P23 | backend/open_webui/routers/configs.py:175 |
| API-0185 | GET | /api/v1/configs/tool_servers | get_tool_servers_config | P23 | backend/open_webui/routers/configs.py:241 |
| API-0186 | POST | /api/v1/configs/tool_servers | set_tool_servers_config | P23 | backend/open_webui/routers/configs.py:246 |
| API-0187 | GET | /api/v1/configs/terminal_servers | get_terminal_servers_config | P23 | backend/open_webui/routers/configs.py:332 |
| API-0188 | POST | /api/v1/configs/terminal_servers | set_terminal_servers_config | P23 | backend/open_webui/routers/configs.py:337 |
| API-0189 | POST | /api/v1/configs/terminal_servers/verify | verify_terminal_server_connection | P23 | backend/open_webui/routers/configs.py:361 |
| API-0190 | POST | /api/v1/configs/terminal_servers/policy | put_terminal_server_policy | P23 | backend/open_webui/routers/configs.py:439 |
| API-0191 | POST | /api/v1/configs/terminal_servers/lifecycle | put_terminal_server_lifecycle | P23 | backend/open_webui/routers/configs.py:479 |
| API-0192 | POST | /api/v1/configs/terminal_servers/refresh | refresh_terminal_server_terminals | P23 | backend/open_webui/routers/configs.py:519 |
| API-0193 | POST | /api/v1/configs/tool_servers/verify | verify_tool_servers_config | P23 | backend/open_webui/routers/configs.py:569 |
| API-0194 | GET | /api/v1/configs/code_execution | get_code_execution_config | P23 | backend/open_webui/routers/configs.py:725 |
| API-0195 | POST | /api/v1/configs/code_execution | set_code_execution_config | P23 | backend/open_webui/routers/configs.py:730 |
| API-0196 | GET | /api/v1/configs/models/defaults | get_models_defaults | P23 | backend/open_webui/routers/configs.py:763 |
| API-0197 | GET | /api/v1/configs/models | get_models_config | P23 | backend/open_webui/routers/configs.py:770 |
| API-0198 | POST | /api/v1/configs/models | set_models_config | P23 | backend/open_webui/routers/configs.py:775 |
| API-0199 | GET | /api/v1/configs/subagents | get_subagents_config | P23 | backend/open_webui/routers/configs.py:804 |
| API-0200 | POST | /api/v1/configs/subagents | set_subagents_config | P23 | backend/open_webui/routers/configs.py:809 |
| API-0201 | POST | /api/v1/configs/suggestions | set_default_suggestions | P23 | backend/open_webui/routers/configs.py:838 |
| API-0202 | POST | /api/v1/configs/banners | set_banners | P23 | backend/open_webui/routers/configs.py:873 |
| API-0203 | GET | /api/v1/configs/banners | get_banners | P23 | backend/open_webui/routers/configs.py:893 |
| API-0204 | GET | /api/v1/evaluations/leaderboard | get_leaderboard | P22 | backend/open_webui/routers/evaluations.py:223 |
| API-0205 | GET | /api/v1/evaluations/leaderboard/{model_id:path}/history | get_model_history | P22 | backend/open_webui/routers/evaluations.py:269 |
| API-0206 | GET | /api/v1/evaluations/config | get_config | P22 | backend/open_webui/routers/evaluations.py:286 |
| API-0207 | POST | /api/v1/evaluations/config | update_config | P22 | backend/open_webui/routers/evaluations.py:301 |
| API-0208 | GET | /api/v1/evaluations/feedbacks/models | get_feedback_model_ids | P22 | backend/open_webui/routers/evaluations.py:328 |
| API-0209 | GET | /api/v1/evaluations/feedbacks/all/ids | get_all_feedback_ids | P22 | backend/open_webui/routers/evaluations.py:333 |
| API-0210 | DELETE | /api/v1/evaluations/feedbacks/all | delete_all_feedbacks | P22 | backend/open_webui/routers/evaluations.py:338 |
| API-0211 | GET | /api/v1/evaluations/feedbacks/all/export | export_all_feedbacks | P22 | backend/open_webui/routers/evaluations.py:355 |
| API-0212 | GET | /api/v1/evaluations/feedbacks/user | get_user_feedbacks | P22 | backend/open_webui/routers/evaluations.py:370 |
| API-0213 | DELETE | /api/v1/evaluations/feedbacks | delete_feedbacks | P22 | backend/open_webui/routers/evaluations.py:382 |
| API-0214 | GET | /api/v1/evaluations/feedbacks/list | get_feedbacks | P22 | backend/open_webui/routers/evaluations.py:400 |
| API-0215 | POST | /api/v1/evaluations/feedback | create_feedback | P22 | backend/open_webui/routers/evaluations.py:426 |
| API-0216 | GET | /api/v1/evaluations/feedback/{id} | get_feedback_by_id | P22 | backend/open_webui/routers/evaluations.py:450 |
| API-0217 | POST | /api/v1/evaluations/feedback/{id} | update_feedback_by_id | P22 | backend/open_webui/routers/evaluations.py:463 |
| API-0218 | DELETE | /api/v1/evaluations/feedback/{id} | delete_feedback_by_id | P22 | backend/open_webui/routers/evaluations.py:489 |
| API-0219 | POST | /api/v1/files/ | upload_file | P09 | backend/open_webui/routers/files.py:281 |
| API-0220 | GET | /api/v1/files/ | list_files | P09 | backend/open_webui/routers/files.py:490 |
| API-0221 | GET | /api/v1/files/search | search_files | P09 | backend/open_webui/routers/files.py:515 |
| API-0222 | GET | /api/v1/files/count | count_files | P09 | backend/open_webui/routers/files.py:562 |
| API-0223 | DELETE | /api/v1/files/all | delete_all_files | P09 | backend/open_webui/routers/files.py:576 |
| API-0224 | GET | /api/v1/files/{id} | get_file_by_id | P09 | backend/open_webui/routers/files.py:606 |
| API-0225 | GET | /api/v1/files/{id}/process/status | get_file_process_status | P09 | backend/open_webui/routers/files.py:625 |
| API-0226 | GET | /api/v1/files/{id}/data/content | get_file_data_content_by_id | P09 | backend/open_webui/routers/files.py:689 |
| API-0227 | POST | /api/v1/files/{id}/data/content/update | update_file_data_content_by_id | P09 | backend/open_webui/routers/files.py:719 |
| API-0228 | GET | /api/v1/files/{id}/content | get_file_content_by_id | P09 | backend/open_webui/routers/files.py:806 |
| API-0229 | GET | /api/v1/files/{id}/content/html | get_html_file_content_by_id | P09 | backend/open_webui/routers/files.py:871 |
| API-0230 | GET | /api/v1/files/{id}/content/{file_name} | get_file_content_by_id | P09 | backend/open_webui/routers/files.py:920 |
| API-0231 | POST | /api/v1/files/{id}/rename | rename_file_by_id | P09 | backend/open_webui/routers/files.py:980 |
| API-0232 | DELETE | /api/v1/files/{id} | delete_file_by_id | P09 | backend/open_webui/routers/files.py:1024 |
| API-0233 | GET | /api/v1/folders/ | get_folders | P06 | backend/open_webui/routers/folders.py:93 |
| API-0234 | POST | /api/v1/folders/ | create_folder | P06 | backend/open_webui/routers/folders.py:151 |
| API-0235 | GET | /api/v1/folders/shared | get_shared_folders | P06 | backend/open_webui/routers/folders.py:243 |
| API-0236 | GET | /api/v1/folders/{id} | get_folder_by_id | P06 | backend/open_webui/routers/folders.py:298 |
| API-0237 | POST | /api/v1/folders/{id}/update | update_folder_name_by_id | P06 | backend/open_webui/routers/folders.py:333 |
| API-0238 | POST | /api/v1/folders/{id}/update/parent | update_folder_parent_id_by_id | P06 | backend/open_webui/routers/folders.py:426 |
| API-0239 | POST | /api/v1/folders/{id}/update/expanded | update_folder_is_expanded_by_id | P06 | backend/open_webui/routers/folders.py:488 |
| API-0240 | POST | /api/v1/folders/{id}/access/update | update_folder_access_by_id | P06 | backend/open_webui/routers/folders.py:533 |
| API-0241 | GET | /api/v1/folders/{id}/shared/chats | get_shared_folder_chats | P06 | backend/open_webui/routers/folders.py:590 |
| API-0242 | POST | /api/v1/folders/{id}/read | mark_folder_chats_read_by_id | P06 | backend/open_webui/routers/folders.py:656 |
| API-0243 | DELETE | /api/v1/folders/{id} | delete_folder_by_id | P06 | backend/open_webui/routers/folders.py:699 |
| API-0244 | GET | /api/v1/functions/ | get_functions | P12 | backend/open_webui/routers/functions.py:51 |
| API-0245 | GET | /api/v1/functions/list | get_function_list | P12 | backend/open_webui/routers/functions.py:59 |
| API-0246 | GET | /api/v1/functions/export | get_functions | P12 | backend/open_webui/routers/functions.py:72 |
| API-0247 | POST | /api/v1/functions/load/url | load_function_from_url | P12 | backend/open_webui/routers/functions.py:110 |
| API-0248 | POST | /api/v1/functions/sync | sync_functions | P12 | backend/open_webui/routers/functions.py:166 |
| API-0249 | POST | /api/v1/functions/create | create_new_function | P12 | backend/open_webui/routers/functions.py:208 |
| API-0250 | GET | /api/v1/functions/id/{id} | get_function_by_id | P12 | backend/open_webui/routers/functions.py:276 |
| API-0251 | POST | /api/v1/functions/id/{id}/toggle | toggle_function_by_id | P12 | backend/open_webui/routers/functions.py:294 |
| API-0252 | POST | /api/v1/functions/id/{id}/toggle/global | toggle_global_by_id | P12 | backend/open_webui/routers/functions.py:348 |
| API-0253 | POST | /api/v1/functions/id/{id}/update | update_function_by_id | P12 | backend/open_webui/routers/functions.py:385 |
| API-0254 | DELETE | /api/v1/functions/id/{id}/delete | delete_function_by_id | P12 | backend/open_webui/routers/functions.py:443 |
| API-0255 | GET | /api/v1/functions/id/{id}/valves | get_function_valves_by_id | P12 | backend/open_webui/routers/functions.py:472 |
| API-0256 | GET | /api/v1/functions/id/{id}/valves/spec | get_function_valves_spec_by_id | P12 | backend/open_webui/routers/functions.py:498 |
| API-0257 | POST | /api/v1/functions/id/{id}/valves/update | update_function_valves_by_id | P12 | backend/open_webui/routers/functions.py:528 |
| API-0258 | GET | /api/v1/functions/id/{id}/valves/user | get_function_user_valves_by_id | P12 | backend/open_webui/routers/functions.py:580 |
| API-0259 | GET | /api/v1/functions/id/{id}/valves/user/spec | get_function_user_valves_spec_by_id | P12 | backend/open_webui/routers/functions.py:601 |
| API-0260 | POST | /api/v1/functions/id/{id}/valves/user/update | update_function_user_valves_by_id | P12 | backend/open_webui/routers/functions.py:629 |
| API-0261 | GET | /api/v1/functions/id/{id}/history | get_function_history | P12 | backend/open_webui/routers/functions.py:696 |
| API-0262 | GET | /api/v1/functions/id/{id}/history/diff | get_function_history_diff | P12 | backend/open_webui/routers/functions.py:704 |
| API-0263 | GET | /api/v1/functions/id/{id}/history/{history_id} | get_function_history_entry | P12 | backend/open_webui/routers/functions.py:714 |
| API-0264 | DELETE | /api/v1/functions/id/{id}/history/{history_id} | delete_function_history_entry | P12 | backend/open_webui/routers/functions.py:722 |
| API-0265 | POST | /api/v1/functions/id/{id}/update/version | set_function_production | P12 | backend/open_webui/routers/functions.py:736 |
| API-0266 | GET | /api/v1/groups/ | get_groups | P03 | backend/open_webui/routers/groups.py:49 |
| API-0267 | POST | /api/v1/groups/create | create_new_group | P03 | backend/open_webui/routers/groups.py:73 |
| API-0268 | GET | /api/v1/groups/id/{id} | get_group_by_id | P03 | backend/open_webui/routers/groups.py:116 |
| API-0269 | GET | /api/v1/groups/id/{id}/info | get_group_info_by_id | P03 | backend/open_webui/routers/groups.py:131 |
| API-0270 | GET | /api/v1/groups/id/{id}/export | export_group_by_id | P03 | backend/open_webui/routers/groups.py:156 |
| API-0271 | POST | /api/v1/groups/id/{id}/users | get_users_in_group | P03 | backend/open_webui/routers/groups.py:177 |
| API-0272 | POST | /api/v1/groups/id/{id}/update | update_group_by_id | P03 | backend/open_webui/routers/groups.py:195 |
| API-0273 | POST | /api/v1/groups/id/{id}/users/add | add_user_to_group | P03 | backend/open_webui/routers/groups.py:240 |
| API-0274 | POST | /api/v1/groups/id/{id}/users/remove | remove_users_from_group | P03 | backend/open_webui/routers/groups.py:282 |
| API-0275 | DELETE | /api/v1/groups/id/{id}/delete | delete_group_by_id | P03 | backend/open_webui/routers/groups.py:326 |
| API-0276 | GET | /api/v1/groups/id/{id}/preview | preview_group_access | P03 | backend/open_webui/routers/groups.py:372 |
| API-0277 | GET | /api/v1/groups/id/{id}/members | inspect_group_members | P03 | backend/open_webui/routers/groups.py:471 |
| API-0278 | GET | /api/v1/images/config | get_config | P16 | backend/open_webui/routers/images.py:273 |
| API-0279 | POST | /api/v1/images/config/update | update_config | P16 | backend/open_webui/routers/images.py:278 |
| API-0280 | POST | /api/v1/images/verify | verify_connection | P16 | backend/open_webui/routers/images.py:340 |
| API-0281 | GET | /api/v1/images/models | get_models | P16 | backend/open_webui/routers/images.py:364 |
| API-0282 | POST | /api/v1/images/generations | generate_images | P16 | backend/open_webui/routers/images.py:569 |
| API-0283 | POST | /api/v1/images/edit | edit_images | P16 | backend/open_webui/routers/images.py:865 |
| API-0284 | GET | /api/v1/knowledge/ | get_knowledge_bases | P13 | backend/open_webui/routers/knowledge.py:173 |
| API-0285 | GET | /api/v1/knowledge/search | search_knowledge_bases | P13 | backend/open_webui/routers/knowledge.py:222 |
| API-0286 | GET | /api/v1/knowledge/search/files | search_knowledge_files | P13 | backend/open_webui/routers/knowledge.py:287 |
| API-0287 | POST | /api/v1/knowledge/create | create_new_knowledge | P13 | backend/open_webui/routers/knowledge.py:319 |
| API-0288 | POST | /api/v1/knowledge/reindex | reindex_knowledge_files | P13 | backend/open_webui/routers/knowledge.py:375 |
| API-0289 | POST | /api/v1/knowledge/metadata/reindex | reindex_knowledge_base_metadata_embeddings | P13 | backend/open_webui/routers/knowledge.py:470 |
| API-0290 | GET | /api/v1/knowledge/external/connections | get_external_knowledge_connections | P13 | backend/open_webui/routers/knowledge.py:692 |
| API-0291 | POST | /api/v1/knowledge/external/connections | create_external_knowledge_connection | P13 | backend/open_webui/routers/knowledge.py:698 |
| API-0292 | GET | /api/v1/knowledge/external/connections/{id} | get_external_knowledge_connection | P13 | backend/open_webui/routers/knowledge.py:719 |
| API-0293 | PATCH | /api/v1/knowledge/external/connections/{id} | update_external_knowledge_connection | P13 | backend/open_webui/routers/knowledge.py:730 |
| API-0294 | DELETE | /api/v1/knowledge/external/connections/{id} | delete_external_knowledge_connection | P13 | backend/open_webui/routers/knowledge.py:756 |
| API-0295 | POST | /api/v1/knowledge/external/connections/{id}/test | test_external_knowledge_connection | P13 | backend/open_webui/routers/knowledge.py:785 |
| API-0296 | POST | /api/v1/knowledge/external/source/test | test_external_knowledge_source | P13 | backend/open_webui/routers/knowledge.py:856 |
| API-0297 | POST | /api/v1/knowledge/external/connections/{id}/retrieve-test | test_external_knowledge_retrieval | P13 | backend/open_webui/routers/knowledge.py:880 |
| API-0298 | POST | /api/v1/knowledge/external/knowledge/create | create_external_knowledge | P13 | backend/open_webui/routers/knowledge.py:895 |
| API-0299 | POST | /api/v1/knowledge/external/source/create | create_external_knowledge_source | P13 | backend/open_webui/routers/knowledge.py:945 |
| API-0300 | PATCH | /api/v1/knowledge/external/source/{id} | update_external_knowledge_source | P13 | backend/open_webui/routers/knowledge.py:1010 |
| API-0301 | GET | /api/v1/knowledge/{id} | get_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1100 |
| API-0302 | POST | /api/v1/knowledge/{id}/update | update_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1147 |
| API-0303 | POST | /api/v1/knowledge/{id}/access/update | update_knowledge_access_by_id | P13 | backend/open_webui/routers/knowledge.py:1225 |
| API-0304 | GET | /api/v1/knowledge/{id}/files/pending | get_pending_knowledge_files | P13 | backend/open_webui/routers/knowledge.py:1285 |
| API-0305 | GET | /api/v1/knowledge/{id}/files | get_knowledge_files_by_id | P13 | backend/open_webui/routers/knowledge.py:1352 |
| API-0306 | POST | /api/v1/knowledge/{id}/file/add | add_file_to_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1426 |
| API-0307 | POST | /api/v1/knowledge/{id}/file/update | update_file_from_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1525 |
| API-0308 | POST | /api/v1/knowledge/{id}/file/remove | remove_file_from_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1614 |
| API-0309 | DELETE | /api/v1/knowledge/{id}/delete | delete_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1703 |
| API-0310 | POST | /api/v1/knowledge/{id}/reset | reset_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:1793 |
| API-0311 | POST | /api/v1/knowledge/{id}/sync/diff | sync_knowledge_diff | P13 | backend/open_webui/routers/knowledge.py:1876 |
| API-0312 | POST | /api/v1/knowledge/{id}/sync/cleanup | sync_knowledge_cleanup | P13 | backend/open_webui/routers/knowledge.py:1996 |
| API-0313 | POST | /api/v1/knowledge/{id}/files/batch/add | add_files_to_knowledge_batch | P13 | backend/open_webui/routers/knowledge.py:2052 |
| API-0314 | GET | /api/v1/knowledge/{id}/export | export_knowledge_by_id | P13 | backend/open_webui/routers/knowledge.py:2178 |
| API-0315 | POST | /api/v1/knowledge/{id}/dirs/create | create_knowledge_directory | P13 | backend/open_webui/routers/knowledge.py:2269 |
| API-0316 | POST | /api/v1/knowledge/{id}/dirs/{dir_id}/update | update_knowledge_directory | P13 | backend/open_webui/routers/knowledge.py:2303 |
| API-0317 | DELETE | /api/v1/knowledge/{id}/dirs/{dir_id}/delete | delete_knowledge_directory | P13 | backend/open_webui/routers/knowledge.py:2340 |
| API-0318 | POST | /api/v1/knowledge/{id}/file/move | move_file_in_knowledge | P13 | backend/open_webui/routers/knowledge.py:2392 |
| API-0319 | GET | /api/v1/memories/ | get_memories | P14 | backend/open_webui/routers/memories.py:58 |
| API-0320 | POST | /api/v1/memories/add | add_memory | P14 | backend/open_webui/routers/memories.py:184 |
| API-0321 | POST | /api/v1/memories/update | update_memories | P14 | backend/open_webui/routers/memories.py:235 |
| API-0322 | POST | /api/v1/memories/query | query_memory | P14 | backend/open_webui/routers/memories.py:333 |
| API-0323 | POST | /api/v1/memories/search | search_memories | P14 | backend/open_webui/routers/memories.py:392 |
| API-0324 | POST | /api/v1/memories/paths | list_memory_paths | P14 | backend/open_webui/routers/memories.py:410 |
| API-0325 | POST | /api/v1/memories/path | read_memory_path | P14 | backend/open_webui/routers/memories.py:426 |
| API-0326 | POST | /api/v1/memories/reindex | reindex_memories_from_vector_db | P14 | backend/open_webui/routers/memories.py:450 |
| API-0327 | POST | /api/v1/memories/reset | reset_memory_from_vector_db | P14 | backend/open_webui/routers/memories.py:484 |
| API-0328 | DELETE | /api/v1/memories/delete/user | delete_memory_by_user_id | P14 | backend/open_webui/routers/memories.py:517 |
| API-0329 | POST | /api/v1/memories/{memory_id}/update | update_memory_by_id | P14 | backend/open_webui/routers/memories.py:549 |
| API-0330 | DELETE | /api/v1/memories/{memory_id} | delete_memory_by_id | P14 | backend/open_webui/routers/memories.py:611 |
| API-0331 | GET | /api/v1/auths/mfa/status | get_mfa_status | P02 | backend/open_webui/routers/mfa.py:97 |
| API-0332 | POST | /api/v1/auths/mfa/challenge | get_mfa_challenge | P02 | backend/open_webui/routers/mfa.py:108 |
| API-0333 | POST | /api/v1/auths/mfa/enroll/start | start_mfa_enrollment | P02 | backend/open_webui/routers/mfa.py:130 |
| API-0334 | POST | /api/v1/auths/mfa/enroll/confirm | confirm_mfa_enrollment | P02 | backend/open_webui/routers/mfa.py:135 |
| API-0335 | POST | /api/v1/auths/mfa/verify | verify_mfa_challenge | P02 | backend/open_webui/routers/mfa.py:148 |
| API-0336 | POST | /api/v1/auths/mfa/replace | start_mfa_replacement | P02 | backend/open_webui/routers/mfa.py:159 |
| API-0337 | POST | /api/v1/auths/mfa/recovery/codes | regenerate_mfa_recovery_codes | P02 | backend/open_webui/routers/mfa.py:171 |
| API-0338 | POST | /api/v1/auths/mfa/recover | redeem_mfa_reset_token | P02 | backend/open_webui/routers/mfa.py:187 |
| API-0339 | GET | /api/v1/models/list | get_models | P10 | backend/open_webui/routers/models.py:227 |
| API-0340 | GET | /api/v1/models/all | get_all_model_records | P10 | backend/open_webui/routers/models.py:306 |
| API-0341 | GET | /api/v1/models/base/tags | get_base_model_tags | P10 | backend/open_webui/routers/models.py:311 |
| API-0342 | GET | /api/v1/models/base | get_base_models | P10 | backend/open_webui/routers/models.py:317 |
| API-0343 | GET | /api/v1/models/tags | get_model_tags | P10 | backend/open_webui/routers/models.py:331 |
| API-0344 | POST | /api/v1/models/create | create_new_model | P10 | backend/open_webui/routers/models.py:346 |
| API-0345 | GET | /api/v1/models/export | export_models | P10 | backend/open_webui/routers/models.py:444 |
| API-0346 | POST | /api/v1/models/import | import_models | P10 | backend/open_webui/routers/models.py:504 |
| API-0347 | POST | /api/v1/models/sync | sync_models | P10 | backend/open_webui/routers/models.py:760 |
| API-0348 | GET | /api/v1/models/model | get_model_by_id | P10 | backend/open_webui/routers/models.py:800 |
| API-0349 | GET | /api/v1/models/model/history | get_model_history | P10 | backend/open_webui/routers/models.py:869 |
| API-0350 | GET | /api/v1/models/model/history/{history_id} | get_model_history_entry | P10 | backend/open_webui/routers/models.py:880 |
| API-0351 | DELETE | /api/v1/models/model/history/{history_id} | delete_model_history_entry | P10 | backend/open_webui/routers/models.py:894 |
| API-0352 | POST | /api/v1/models/model/update/version | set_model_version | P10 | backend/open_webui/routers/models.py:957 |
| API-0353 | GET | /api/v1/models/model/profile/image | get_model_profile_image | P10 | backend/open_webui/routers/models.py:991 |
| API-0354 | POST | /api/v1/models/model/toggle | toggle_model_by_id | P10 | backend/open_webui/routers/models.py:1100 |
| API-0355 | POST | /api/v1/models/model/update | update_model_by_id | P10 | backend/open_webui/routers/models.py:1151 |
| API-0356 | POST | /api/v1/models/model/access/update | update_model_access_by_id | P10 | backend/open_webui/routers/models.py:1258 |
| API-0357 | POST | /api/v1/models/model/delete | delete_model_by_id | P10 | backend/open_webui/routers/models.py:1334 |
| API-0358 | DELETE | /api/v1/models/delete/all | delete_all_models | P10 | backend/open_webui/routers/models.py:1376 |
| API-0359 | GET | /api/v1/notes/ | get_notes | P18 | backend/open_webui/routers/notes.py:98 |
| API-0360 | GET | /api/v1/notes/pinned | get_pinned_notes | P18 | backend/open_webui/routers/notes.py:141 |
| API-0361 | GET | /api/v1/notes/search | search_notes | P18 | backend/open_webui/routers/notes.py:170 |
| API-0362 | POST | /api/v1/notes/create | create_new_note | P18 | backend/open_webui/routers/notes.py:222 |
| API-0363 | GET | /api/v1/notes/{id} | get_note_by_id | P18 | backend/open_webui/routers/notes.py:264 |
| API-0364 | GET | /api/v1/notes/{id}/chat | get_note_chat_by_id | P18 | backend/open_webui/routers/notes.py:311 |
| API-0365 | GET | /api/v1/notes/{id}/chats | get_note_chats_by_id | P18 | backend/open_webui/routers/notes.py:396 |
| API-0366 | POST | /api/v1/notes/{id}/chat | create_note_chat_by_id | P18 | backend/open_webui/routers/notes.py:448 |
| API-0367 | POST | /api/v1/notes/{id}/update | update_note_by_id | P18 | backend/open_webui/routers/notes.py:511 |
| API-0368 | POST | /api/v1/notes/{id}/access/update | update_note_access_by_id | P18 | backend/open_webui/routers/notes.py:591 |
| API-0369 | POST | /api/v1/notes/{id}/pin | pin_note_by_id | P18 | backend/open_webui/routers/notes.py:645 |
| API-0370 | DELETE | /api/v1/notes/{id}/delete | delete_note_by_id | P18 | backend/open_webui/routers/notes.py:688 |
| API-0371 | GET | /api/v1/notifications/events | get_notification_events | P23 | backend/open_webui/routers/notifications.py:45 |
| API-0372 | GET | /api/v1/notifications/targets | get_notification_targets | P23 | backend/open_webui/routers/notifications.py:51 |
| API-0373 | POST | /api/v1/notifications/targets | create_notification_target | P23 | backend/open_webui/routers/notifications.py:57 |
| API-0374 | PUT | /api/v1/notifications/targets/{target_id} | update_notification_target | P23 | backend/open_webui/routers/notifications.py:66 |
| API-0375 | DELETE | /api/v1/notifications/targets/{target_id} | delete_notification_target | P23 | backend/open_webui/routers/notifications.py:77 |
| API-0376 | PUT | /api/v1/notifications/targets/{target_id}/default | set_default_notification_target | P23 | backend/open_webui/routers/notifications.py:85 |
| API-0377 | POST | /api/v1/notifications/targets/{target_id}/test | test_notification_target | P23 | backend/open_webui/routers/notifications.py:94 |
| API-0378 | HEAD | /ollama/ | get_status | P04 | backend/open_webui/routers/ollama.py:229 |
| API-0379 | GET | /ollama/ | get_status | P04 | backend/open_webui/routers/ollama.py:229 |
| API-0380 | POST | /ollama/verify | verify_connection | P04 | backend/open_webui/routers/ollama.py:242 |
| API-0381 | GET | /ollama/config | get_config | P04 | backend/open_webui/routers/ollama.py:278 |
| API-0382 | POST | /ollama/config/update | update_config | P04 | backend/open_webui/routers/ollama.py:309 |
| API-0383 | GET | /ollama/api/tags | get_ollama_tags | P04 | backend/open_webui/routers/ollama.py:477 |
| API-0384 | GET | /ollama/api/tags/{url_idx} | get_ollama_tags | P04 | backend/open_webui/routers/ollama.py:477 |
| API-0385 | GET | /ollama/api/ps | get_ollama_loaded_models | P04 | backend/open_webui/routers/ollama.py:509 |
| API-0386 | GET | /ollama/api/version | get_ollama_versions | P04 | backend/open_webui/routers/ollama.py:551 |
| API-0387 | GET | /ollama/api/version/{url_idx} | get_ollama_versions | P04 | backend/open_webui/routers/ollama.py:551 |
| API-0388 | POST | /ollama/api/unload | unload_model | P04 | backend/open_webui/routers/ollama.py:607 |
| API-0389 | POST | /ollama/api/pull | pull_model | P04 | backend/open_webui/routers/ollama.py:669 |
| API-0390 | POST | /ollama/api/pull/{url_idx} | pull_model | P04 | backend/open_webui/routers/ollama.py:669 |
| API-0391 | DELETE | /ollama/api/push | push_model | P04 | backend/open_webui/routers/ollama.py:707 |
| API-0392 | DELETE | /ollama/api/push/{url_idx} | push_model | P04 | backend/open_webui/routers/ollama.py:707 |
| API-0393 | POST | /ollama/api/create | create_model | P04 | backend/open_webui/routers/ollama.py:750 |
| API-0394 | POST | /ollama/api/create/{url_idx} | create_model | P04 | backend/open_webui/routers/ollama.py:750 |
| API-0395 | POST | /ollama/api/copy | copy_model | P04 | backend/open_webui/routers/ollama.py:783 |
| API-0396 | POST | /ollama/api/copy/{url_idx} | copy_model | P04 | backend/open_webui/routers/ollama.py:783 |
| API-0397 | DELETE | /ollama/api/delete | delete_model | P04 | backend/open_webui/routers/ollama.py:822 |
| API-0398 | DELETE | /ollama/api/delete/{url_idx} | delete_model | P04 | backend/open_webui/routers/ollama.py:822 |
| API-0399 | POST | /ollama/api/show | show_model_info | P04 | backend/open_webui/routers/ollama.py:865 |
| API-0400 | POST | /ollama/api/embed | embed | P04 | backend/open_webui/routers/ollama.py:912 |
| API-0401 | POST | /ollama/api/embed/{url_idx} | embed | P04 | backend/open_webui/routers/ollama.py:912 |
| API-0402 | POST | /ollama/api/embeddings | embeddings | P04 | backend/open_webui/routers/ollama.py:965 |
| API-0403 | POST | /ollama/api/embeddings/{url_idx} | embeddings | P04 | backend/open_webui/routers/ollama.py:965 |
| API-0404 | POST | /ollama/api/generate | generate_completion | P04 | backend/open_webui/routers/ollama.py:1026 |
| API-0405 | POST | /ollama/api/generate/{url_idx} | generate_completion | P04 | backend/open_webui/routers/ollama.py:1026 |
| API-0406 | POST | /ollama/api/chat | generate_chat_completion | P04 | backend/open_webui/routers/ollama.py:1130 |
| API-0407 | POST | /ollama/api/chat/{url_idx} | generate_chat_completion | P04 | backend/open_webui/routers/ollama.py:1130 |
| API-0408 | POST | /ollama/v1/completions | generate_openai_completion | P04 | backend/open_webui/routers/ollama.py:1247 |
| API-0409 | POST | /ollama/v1/completions/{url_idx} | generate_openai_completion | P04 | backend/open_webui/routers/ollama.py:1247 |
| API-0410 | POST | /ollama/v1/embeddings | generate_openai_embeddings | P04 | backend/open_webui/routers/ollama.py:1302 |
| API-0411 | POST | /ollama/v1/embeddings/{url_idx} | generate_openai_embeddings | P04 | backend/open_webui/routers/ollama.py:1302 |
| API-0412 | POST | /ollama/v1/chat/completions | generate_openai_chat_completion | P04 | backend/open_webui/routers/ollama.py:1351 |
| API-0413 | POST | /ollama/v1/chat/completions/{url_idx} | generate_openai_chat_completion | P04 | backend/open_webui/routers/ollama.py:1351 |
| API-0414 | POST | /ollama/v1/messages | generate_anthropic_messages | P04 | backend/open_webui/routers/ollama.py:1410 |
| API-0415 | POST | /ollama/v1/messages/{url_idx} | generate_anthropic_messages | P04 | backend/open_webui/routers/ollama.py:1410 |
| API-0416 | POST | /ollama/v1/responses | generate_responses | P04 | backend/open_webui/routers/ollama.py:1468 |
| API-0417 | POST | /ollama/v1/responses/{url_idx} | generate_responses | P04 | backend/open_webui/routers/ollama.py:1468 |
| API-0418 | GET | /ollama/v1/models | get_openai_models | P04 | backend/open_webui/routers/ollama.py:1520 |
| API-0419 | GET | /ollama/v1/models/{url_idx} | get_openai_models | P04 | backend/open_webui/routers/ollama.py:1520 |
| API-0420 | POST | /ollama/models/download | download_model | P04 | backend/open_webui/routers/ollama.py:1668 |
| API-0421 | POST | /ollama/models/download/{url_idx} | download_model | P04 | backend/open_webui/routers/ollama.py:1668 |
| API-0422 | POST | /ollama/models/upload | upload_model | P04 | backend/open_webui/routers/ollama.py:1698 |
| API-0423 | POST | /ollama/models/upload/{url_idx} | upload_model | P04 | backend/open_webui/routers/ollama.py:1698 |
| API-0424 | GET | /openai/config | get_config | P04 | backend/open_webui/routers/openai.py:462 |
| API-0425 | POST | /openai/config/update | update_config | P04 | backend/open_webui/routers/openai.py:474 |
| API-0426 | POST | /openai/audio/speech | speech | P04 | backend/open_webui/routers/openai.py:518 |
| API-0427 | GET | /openai/models | get_models | P04 | backend/open_webui/routers/openai.py:785 |
| API-0428 | GET | /openai/models/{url_idx} | get_models | P04 | backend/open_webui/routers/openai.py:785 |
| API-0429 | GET | /openai/models/{url_idx}/catalog | get_provider_model_catalog | P04 | backend/open_webui/routers/openai.py:869 |
| API-0430 | POST | /openai/models/{url_idx}/download | download_provider_model | P04 | backend/open_webui/routers/openai.py:874 |
| API-0431 | GET | /openai/models/{url_idx}/download/status/{job_id} | get_provider_model_download_status | P04 | backend/open_webui/routers/openai.py:897 |
| API-0432 | POST | /openai/models/{url_idx}/load | load_provider_model | P04 | backend/open_webui/routers/openai.py:913 |
| API-0433 | POST | /openai/models/{url_idx}/unload | unload_provider_model | P04 | backend/open_webui/routers/openai.py:929 |
| API-0434 | GET | /openai/models/{url_idx}/sse | stream_provider_model_events | P04 | backend/open_webui/routers/openai.py:945 |
| API-0435 | DELETE | /openai/models/{url_idx} | delete_provider_model | P04 | backend/open_webui/routers/openai.py:950 |
| API-0436 | POST | /openai/verify | verify_connection | P04 | backend/open_webui/routers/openai.py:986 |
| API-0437 | POST | /openai/chat/completions | generate_chat_completion | P04 | backend/open_webui/routers/openai.py:1407 |
| API-0438 | POST | /openai/responses | responses | P04 | backend/open_webui/routers/openai.py:1808 |
| API-0439 | API_ROUTE | /openai/{path:path} | proxy | P04 | backend/open_webui/routers/openai.py:1920 |
| API-0440 | GET | /api/v1/pipelines/list | get_pipelines_list | P12 | backend/open_webui/routers/pipelines.py:205 |
| API-0441 | POST | /api/v1/pipelines/upload | upload_pipeline | P12 | backend/open_webui/routers/pipelines.py:224 |
| API-0442 | POST | /api/v1/pipelines/add | add_pipeline | P12 | backend/open_webui/routers/pipelines.py:317 |
| API-0443 | DELETE | /api/v1/pipelines/delete | delete_pipeline | P12 | backend/open_webui/routers/pipelines.py:367 |
| API-0444 | GET | /api/v1/pipelines/ | get_pipelines | P12 | backend/open_webui/routers/pipelines.py:412 |
| API-0445 | GET | /api/v1/pipelines/{pipeline_id}/valves | get_pipeline_valves | P12 | backend/open_webui/routers/pipelines.py:447 |
| API-0446 | GET | /api/v1/pipelines/{pipeline_id}/valves/spec | get_pipeline_valves_spec | P12 | backend/open_webui/routers/pipelines.py:494 |
| API-0447 | POST | /api/v1/pipelines/{pipeline_id}/valves/update | update_pipeline_valves | P12 | backend/open_webui/routers/pipelines.py:534 |
| API-0448 | GET | /api/v1/prompts/ | get_prompts | P11 | backend/open_webui/routers/prompts.py:55 |
| API-0449 | GET | /api/v1/prompts/tags | get_prompt_tags | P11 | backend/open_webui/routers/prompts.py:65 |
| API-0450 | GET | /api/v1/prompts/list | get_prompt_list | P11 | backend/open_webui/routers/prompts.py:72 |
| API-0451 | POST | /api/v1/prompts/create | create_new_prompt | P11 | backend/open_webui/routers/prompts.py:144 |
| API-0452 | GET | /api/v1/prompts/id/{prompt_id} | get_prompt_by_id | P11 | backend/open_webui/routers/prompts.py:206 |
| API-0453 | POST | /api/v1/prompts/id/{prompt_id}/update | update_prompt_by_id | P11 | backend/open_webui/routers/prompts.py:250 |
| API-0454 | POST | /api/v1/prompts/id/{prompt_id}/update/meta | update_prompt_metadata | P11 | backend/open_webui/routers/prompts.py:324 |
| API-0455 | POST | /api/v1/prompts/id/{prompt_id}/update/version | set_prompt_version | P11 | backend/open_webui/routers/prompts.py:385 |
| API-0456 | POST | /api/v1/prompts/id/{prompt_id}/access/update | update_prompt_access_by_id | P11 | backend/open_webui/routers/prompts.py:442 |
| API-0457 | POST | /api/v1/prompts/id/{prompt_id}/toggle | toggle_prompt_active | P11 | backend/open_webui/routers/prompts.py:499 |
| API-0458 | DELETE | /api/v1/prompts/id/{prompt_id}/delete | delete_prompt_by_id | P11 | backend/open_webui/routers/prompts.py:552 |
| API-0459 | GET | /api/v1/prompts/id/{prompt_id}/history | get_prompt_history | P11 | backend/open_webui/routers/prompts.py:600 |
| API-0460 | GET | /api/v1/prompts/id/{prompt_id}/history/diff | get_prompt_diff | P11 | backend/open_webui/routers/prompts.py:639 |
| API-0461 | GET | /api/v1/prompts/id/{prompt_id}/history/{history_id} | get_prompt_history_entry | P11 | backend/open_webui/routers/prompts.py:683 |
| API-0462 | DELETE | /api/v1/prompts/id/{prompt_id}/history/{history_id} | delete_prompt_history_entry | P11 | backend/open_webui/routers/prompts.py:726 |
| API-0463 | GET | /api/v1/retrieval/embedding | get_embedding_config | P13 | backend/open_webui/routers/retrieval.py:442 |
| API-0464 | POST | /api/v1/retrieval/embedding/update | update_embedding_config | P13 | backend/open_webui/routers/retrieval.py:511 |
| API-0465 | GET | /api/v1/retrieval/config | get_rag_config | P13 | backend/open_webui/routers/retrieval.py:603 |
| API-0466 | POST | /api/v1/retrieval/config/update | update_rag_config | P13 | backend/open_webui/routers/retrieval.py:937 |
| API-0467 | POST | /api/v1/retrieval/process/file | process_file | P13 | backend/open_webui/routers/retrieval.py:1572 |
| API-0468 | POST | /api/v1/retrieval/process/text | process_text | P13 | backend/open_webui/routers/retrieval.py:1847 |
| API-0469 | POST | /api/v1/retrieval/process/url | process_url | P13 | backend/open_webui/routers/retrieval.py:2004 |
| API-0470 | POST | /api/v1/retrieval/process/youtube | process_web | P13 | backend/open_webui/routers/retrieval.py:2087 |
| API-0471 | POST | /api/v1/retrieval/process/web | process_web | P13 | backend/open_webui/routers/retrieval.py:2087 |
| API-0472 | POST | /api/v1/retrieval/process/web/search | process_web_search | P13 | backend/open_webui/routers/retrieval.py:2554 |
| API-0473 | POST | /api/v1/retrieval/query/doc | query_doc_handler | P13 | backend/open_webui/routers/retrieval.py:2749 |
| API-0474 | POST | /api/v1/retrieval/query/collection | query_collection_handler | P13 | backend/open_webui/routers/retrieval.py:2815 |
| API-0475 | POST | /api/v1/retrieval/delete | delete_entries_from_collection | P13 | backend/open_webui/routers/retrieval.py:2885 |
| API-0476 | POST | /api/v1/retrieval/reset/db | reset_vector_db | P13 | backend/open_webui/routers/retrieval.py:2945 |
| API-0477 | POST | /api/v1/retrieval/reset/uploads | reset_upload_dir | P13 | backend/open_webui/routers/retrieval.py:2961 |
| API-0478 | POST | /api/v1/retrieval/process/files/batch | process_files_batch | P13 | backend/open_webui/routers/retrieval.py:3017 |
| API-0479 | GET | /api/v1/retrieval/ef/{text} | get_embeddings | P13 | backend/open_webui/routers/retrieval.py:2996 |
| API-0480 | GET | /api/v1/scim/v2/ServiceProviderConfig | get_service_provider_config | P03 | backend/open_webui/routers/scim.py:419 |
| API-0481 | GET | /api/v1/scim/v2/ResourceTypes | get_resource_types | P03 | backend/open_webui/routers/scim.py:441 |
| API-0482 | GET | /api/v1/scim/v2/Schemas | get_schemas | P03 | backend/open_webui/routers/scim.py:471 |
| API-0483 | GET | /api/v1/scim/v2/Users | get_users | P03 | backend/open_webui/routers/scim.py:516 |
| API-0484 | GET | /api/v1/scim/v2/Users/{user_id} | get_user | P03 | backend/open_webui/routers/scim.py:576 |
| API-0485 | POST | /api/v1/scim/v2/Users | create_user | P03 | backend/open_webui/routers/scim.py:591 |
| API-0486 | PUT | /api/v1/scim/v2/Users/{user_id} | update_user | P03 | backend/open_webui/routers/scim.py:677 |
| API-0487 | PATCH | /api/v1/scim/v2/Users/{user_id} | patch_user | P03 | backend/open_webui/routers/scim.py:757 |
| API-0488 | DELETE | /api/v1/scim/v2/Users/{user_id} | delete_user | P03 | backend/open_webui/routers/scim.py:860 |
| API-0489 | GET | /api/v1/scim/v2/Groups | get_groups | P03 | backend/open_webui/routers/scim.py:894 |
| API-0490 | GET | /api/v1/scim/v2/Groups/{group_id} | get_group | P03 | backend/open_webui/routers/scim.py:938 |
| API-0491 | POST | /api/v1/scim/v2/Groups | create_group | P03 | backend/open_webui/routers/scim.py:969 |
| API-0492 | PUT | /api/v1/scim/v2/Groups/{group_id} | update_group | P03 | backend/open_webui/routers/scim.py:1040 |
| API-0493 | PATCH | /api/v1/scim/v2/Groups/{group_id} | patch_group | P03 | backend/open_webui/routers/scim.py:1111 |
| API-0494 | DELETE | /api/v1/scim/v2/Groups/{group_id} | delete_group | P03 | backend/open_webui/routers/scim.py:1210 |
| API-0495 | GET | /api/v1/skills/ | get_skills | P11 | backend/open_webui/routers/skills.py:57 |
| API-0496 | GET | /api/v1/skills/list | get_skill_list | P11 | backend/open_webui/routers/skills.py:81 |
| API-0497 | GET | /api/v1/skills/export | export_skills | P11 | backend/open_webui/routers/skills.py:165 |
| API-0498 | POST | /api/v1/skills/create | create_new_skill | P11 | backend/open_webui/routers/skills.py:217 |
| API-0499 | GET | /api/v1/skills/id/{id} | get_skill_by_id | P11 | backend/open_webui/routers/skills.py:296 |
| API-0500 | POST | /api/v1/skills/id/{id}/update | update_skill_by_id | P11 | backend/open_webui/routers/skills.py:343 |
| API-0501 | POST | /api/v1/skills/id/{id}/access/update | update_skill_access_by_id | P11 | backend/open_webui/routers/skills.py:426 |
| API-0502 | POST | /api/v1/skills/id/{id}/toggle | toggle_skill_by_id | P11 | backend/open_webui/routers/skills.py:483 |
| API-0503 | DELETE | /api/v1/skills/id/{id}/delete | delete_skill_by_id | P11 | backend/open_webui/routers/skills.py:536 |
| API-0504 | GET | /api/v1/skills/id/{id}/files | get_skill_files | P11 | backend/open_webui/routers/skills.py:578 |
| API-0505 | GET | /api/v1/skills/id/{id}/files/content | get_skill_file | P11 | backend/open_webui/routers/skills.py:593 |
| API-0506 | GET | /api/v1/skills/id/{id}/history | get_skill_history | P11 | backend/open_webui/routers/skills.py:614 |
| API-0507 | GET | /api/v1/skills/id/{id}/history/diff | diff_skill_history | P11 | backend/open_webui/routers/skills.py:622 |
| API-0508 | GET | /api/v1/skills/id/{id}/history/diff/file | diff_skill_file | P11 | backend/open_webui/routers/skills.py:650 |
| API-0509 | GET | /api/v1/skills/id/{id}/history/{history_id} | get_skill_history_entry | P11 | backend/open_webui/routers/skills.py:683 |
| API-0510 | DELETE | /api/v1/skills/id/{id}/history/{history_id} | delete_skill_history_entry | P11 | backend/open_webui/routers/skills.py:699 |
| API-0511 | POST | /api/v1/skills/id/{id}/update/version | set_skill_version | P11 | backend/open_webui/routers/skills.py:714 |
| API-0512 | POST | /api/v1/skills/id/{id}/clone | clone_skill | P11 | backend/open_webui/routers/skills.py:736 |
| API-0513 | POST | /api/v1/skills/load/url | load_skill_by_url | P11 | backend/open_webui/routers/skills.py:803 |
| API-0514 | POST | /api/v1/skills/import/preview | preview_skill_import | P11 | backend/open_webui/routers/skills.py:814 |
| API-0515 | POST | /api/v1/skills/import | import_skills | P11 | backend/open_webui/routers/skills.py:844 |
| API-0516 | GET | /api/v1/tasks/config | get_task_config | P05 | backend/open_webui/routers/tasks.py:110 |
| API-0517 | POST | /api/v1/tasks/config/update | update_task_config | P05 | backend/open_webui/routers/tasks.py:137 |
| API-0518 | POST | /api/v1/tasks/title/completions | generate_title | P05 | backend/open_webui/routers/tasks.py:146 |
| API-0519 | POST | /api/v1/tasks/follow_up/completions | generate_follow_ups | P05 | backend/open_webui/routers/tasks.py:219 |
| API-0520 | POST | /api/v1/tasks/tags/completions | generate_chat_tags | P05 | backend/open_webui/routers/tasks.py:284 |
| API-0521 | POST | /api/v1/tasks/image_prompt/completions | generate_image_prompt | P05 | backend/open_webui/routers/tasks.py:349 |
| API-0522 | POST | /api/v1/tasks/queries/completions | generate_queries | P05 | backend/open_webui/routers/tasks.py:408 |
| API-0523 | POST | /api/v1/tasks/auto/completions | generate_autocompletion | P05 | backend/open_webui/routers/tasks.py:484 |
| API-0524 | POST | /api/v1/tasks/emoji/completions | generate_emoji | P05 | backend/open_webui/routers/tasks.py:561 |
| API-0525 | POST | /api/v1/tasks/moa/completions | generate_moa_response | P05 | backend/open_webui/routers/tasks.py:615 |
| API-0526 | GET | /api/v1/terminals/ | list_terminal_servers | P21 | backend/open_webui/routers/terminals.py:88 |
| API-0527 | API_ROUTE | /api/v1/terminals/{server_id}/{path:path} | proxy_terminal | P21 | backend/open_webui/routers/terminals.py:115 |
| API-0528 | API_ROUTE | /api/v1/terminals/{server_id}/chats/{chat_id}/{path:path} | proxy_terminal | P21 | backend/open_webui/routers/terminals.py:115 |
| API-0529 | WEBSOCKET | /api/v1/terminals/{server_id}/api/terminals/{session_id} | ws_terminal | P21 | backend/open_webui/routers/terminals.py:335 |
| API-0530 | GET | /api/v1/tools/ | get_tools | P12 | backend/open_webui/routers/tools.py:77 |
| API-0531 | GET | /api/v1/tools/id/{id}/specs | get_tool_specs | P12 | backend/open_webui/routers/tools.py:206 |
| API-0532 | GET | /api/v1/tools/list | get_tool_list | P12 | backend/open_webui/routers/tools.py:237 |
| API-0533 | POST | /api/v1/tools/load/url | load_tool_from_url | P12 | backend/open_webui/routers/tools.py:304 |
| API-0534 | GET | /api/v1/tools/export | export_tools | P12 | backend/open_webui/routers/tools.py:356 |
| API-0535 | POST | /api/v1/tools/create | create_new_tools | P12 | backend/open_webui/routers/tools.py:386 |
| API-0536 | GET | /api/v1/tools/id/{id} | get_tools_by_id | P12 | backend/open_webui/routers/tools.py:475 |
| API-0537 | POST | /api/v1/tools/id/{id}/update | update_tools_by_id | P12 | backend/open_webui/routers/tools.py:524 |
| API-0538 | POST | /api/v1/tools/id/{id}/access/update | update_tool_access_by_id | P12 | backend/open_webui/routers/tools.py:636 |
| API-0539 | DELETE | /api/v1/tools/id/{id}/delete | delete_tools_by_id | P12 | backend/open_webui/routers/tools.py:693 |
| API-0540 | GET | /api/v1/tools/id/{id}/valves | get_tools_valves_by_id | P12 | backend/open_webui/routers/tools.py:745 |
| API-0541 | GET | /api/v1/tools/id/{id}/valves/spec | get_tools_valves_spec_by_id | P12 | backend/open_webui/routers/tools.py:787 |
| API-0542 | POST | /api/v1/tools/id/{id}/valves/update | update_tools_valves_by_id | P12 | backend/open_webui/routers/tools.py:833 |
| API-0543 | GET | /api/v1/tools/id/{id}/valves/user | get_tools_user_valves_by_id | P12 | backend/open_webui/routers/tools.py:898 |
| API-0544 | GET | /api/v1/tools/id/{id}/valves/user/spec | get_tools_user_valves_spec_by_id | P12 | backend/open_webui/routers/tools.py:935 |
| API-0545 | POST | /api/v1/tools/id/{id}/valves/user/update | update_tools_user_valves_by_id | P12 | backend/open_webui/routers/tools.py:976 |
| API-0546 | GET | /api/v1/tools/id/{id}/history | get_tool_history | P12 | backend/open_webui/routers/tools.py:1067 |
| API-0547 | GET | /api/v1/tools/id/{id}/history/diff | get_tool_history_diff | P12 | backend/open_webui/routers/tools.py:1075 |
| API-0548 | GET | /api/v1/tools/id/{id}/history/{history_id} | get_tool_history_entry | P12 | backend/open_webui/routers/tools.py:1085 |
| API-0549 | DELETE | /api/v1/tools/id/{id}/history/{history_id} | delete_tool_history_entry | P12 | backend/open_webui/routers/tools.py:1093 |
| API-0550 | POST | /api/v1/tools/id/{id}/update/version | set_tool_production | P12 | backend/open_webui/routers/tools.py:1107 |
| API-0551 | GET | /api/v1/users/ | get_users | P02 | backend/open_webui/routers/users.py:83 |
| API-0552 | GET | /api/v1/users/all | get_all_users | P02 | backend/open_webui/routers/users.py:130 |
| API-0553 | GET | /api/v1/users/search | search_users | P02 | backend/open_webui/routers/users.py:138 |
| API-0554 | GET | /api/v1/users/groups | get_user_groups | P02 | backend/open_webui/routers/users.py:170 |
| API-0555 | GET | /api/v1/users/permissions | get_user_permissisions | P02 | backend/open_webui/routers/users.py:182 |
| API-0556 | GET | /api/v1/users/default/permissions | get_default_user_permissions | P02 | backend/open_webui/routers/users.py:414 |
| API-0557 | POST | /api/v1/users/default/permissions | update_default_user_permissions | P02 | backend/open_webui/routers/users.py:427 |
| API-0558 | GET | /api/v1/users/default/permissions/defaults | get_default_user_permissions_defaults | P02 | backend/open_webui/routers/users.py:441 |
| API-0559 | GET | /api/v1/users/user/settings | get_user_settings_by_session_user | P02 | backend/open_webui/routers/users.py:460 |
| API-0560 | POST | /api/v1/users/user/settings/update | update_user_settings_by_session_user | P02 | backend/open_webui/routers/users.py:485 |
| API-0561 | GET | /api/v1/users/user/status | get_user_status_by_session_user | P02 | backend/open_webui/routers/users.py:573 |
| API-0562 | POST | /api/v1/users/user/status/update | update_user_status_by_session_user | P02 | backend/open_webui/routers/users.py:592 |
| API-0563 | GET | /api/v1/users/user/info | get_user_info_by_session_user | P02 | backend/open_webui/routers/users.py:625 |
| API-0564 | GET | /api/v1/users/user/variables | get_user_variables_by_session_user | P02 | backend/open_webui/routers/users.py:644 |
| API-0565 | POST | /api/v1/users/user/variables/update | update_user_variables_by_session_user | P02 | backend/open_webui/routers/users.py:654 |
| API-0566 | POST | /api/v1/users/user/info/update | update_user_info_by_session_user | P02 | backend/open_webui/routers/users.py:682 |
| API-0567 | GET | /api/v1/users/usage | get_user_usage_by_session_user | P02 | backend/open_webui/routers/users.py:709 |
| API-0568 | GET | /api/v1/users/{user_id} | get_user_by_id | P02 | backend/open_webui/routers/users.py:797 |
| API-0569 | GET | /api/v1/users/{user_id}/info | get_user_info_by_id | P02 | backend/open_webui/routers/users.py:817 |
| API-0570 | GET | /api/v1/users/{user_id}/oauth/sessions | get_user_oauth_sessions_by_id | P02 | backend/open_webui/routers/users.py:838 |
| API-0571 | GET | /api/v1/users/{user_id}/profile/image | get_user_profile_image_by_id | P02 | backend/open_webui/routers/users.py:857 |
| API-0572 | GET | /api/v1/users/{user_id}/active | get_user_active_status_by_id | P02 | backend/open_webui/routers/users.py:904 |
| API-0573 | POST | /api/v1/users/{user_id}/sessions/revoke | revoke_user_sessions | P02 | backend/open_webui/routers/users.py:918 |
| API-0574 | POST | /api/v1/users/{user_id}/update | update_user_by_id | P02 | backend/open_webui/routers/users.py:933 |
| API-0575 | DELETE | /api/v1/users/{user_id} | delete_user_by_id | P02 | backend/open_webui/routers/users.py:1062 |
| API-0576 | GET | /api/v1/users/{user_id}/groups | get_user_groups_by_id | P02 | backend/open_webui/routers/users.py:1112 |
| API-0577 | GET | /api/v1/users/{user_id}/preview | get_user_preview | P02 | backend/open_webui/routers/users.py:1127 |
| API-0578 | GET | /api/v1/utils/gravatar | get_gravatar | P24 | backend/open_webui/routers/utils.py:22 |
| API-0579 | POST | /api/v1/utils/code/format | format_code | P24 | backend/open_webui/routers/utils.py:31 |
| API-0580 | POST | /api/v1/utils/code/execute | execute_code | P24 | backend/open_webui/routers/utils.py:42 |
| API-0581 | GET | /api/v1/utils/db/download | download_db | P24 | backend/open_webui/routers/utils.py:75 |

## Socket.IO events

| ID | Event | Owner | Source |
|---|---|---|---|
| EVT-001 | usage | P05 | backend/open_webui/socket/main.py:470 |
| EVT-002 | connect | P05 | backend/open_webui/socket/main.py:484 |
| EVT-003 | user-join | P05 | backend/open_webui/socket/main.py:512 |
| EVT-004 | heartbeat | P05 | backend/open_webui/socket/main.py:579 |
| EVT-005 | join-channels | P17 | backend/open_webui/socket/main.py:591 |
| EVT-006 | join-note | P18 | backend/open_webui/socket/main.py:613 |
| EVT-007 | events:channel | P17 | backend/open_webui/socket/main.py:654 |
| EVT-008 | events:chat | P05 | backend/open_webui/socket/main.py:701 |
| EVT-009 | ydoc:document:join | P18 | backend/open_webui/socket/main.py:810 |
| EVT-010 | ydoc:document:state | P18 | backend/open_webui/socket/main.py:930 |
| EVT-011 | ydoc:document:update | P18 | backend/open_webui/socket/main.py:972 |
| EVT-012 | ydoc:document:leave | P18 | backend/open_webui/socket/main.py:1064 |
| EVT-013 | ydoc:awareness:update | P18 | backend/open_webui/socket/main.py:1096 |
| EVT-014 | disconnect | P05 | backend/open_webui/socket/main.py:1121 |
| EVT-015 | * | P05 | backend/open_webui/socket/main.py:1177 |

## Business event registry

| ID | Event | Owner | Source |
|---|---|---|---|
| BUS-001 | system.startup.started | P23 | backend/open_webui/events.py:46 |
| BUS-002 | system.startup.completed | P23 | backend/open_webui/events.py:49 |
| BUS-003 | system.shutdown.started | P23 | backend/open_webui/events.py:52 |
| BUS-004 | system.shutdown.completed | P23 | backend/open_webui/events.py:55 |
| BUS-005 | config.imported | P23 | backend/open_webui/events.py:58 |
| BUS-006 | config.updated | P23 | backend/open_webui/events.py:61 |
| BUS-007 | config.webhook.updated | P23 | backend/open_webui/events.py:64 |
| BUS-008 | config.connections.updated | P23 | backend/open_webui/events.py:69 |
| BUS-009 | config.tool_servers.updated | P23 | backend/open_webui/events.py:74 |
| BUS-010 | config.terminal_servers.updated | P23 | backend/open_webui/events.py:79 |
| BUS-011 | config.code_execution.updated | P23 | backend/open_webui/events.py:84 |
| BUS-012 | config.models.updated | P23 | backend/open_webui/events.py:89 |
| BUS-013 | config.banners.updated | P23 | backend/open_webui/events.py:92 |
| BUS-014 | config.suggestions.updated | P23 | backend/open_webui/events.py:95 |
| BUS-015 | auth.signup | P23 | backend/open_webui/events.py:100 |
| BUS-016 | auth.mfa.enrolled | P23 | backend/open_webui/events.py:103 |
| BUS-017 | auth.mfa.replaced | P23 | backend/open_webui/events.py:106 |
| BUS-018 | auth.mfa.failed | P23 | backend/open_webui/events.py:109 |
| BUS-019 | auth.mfa.throttled | P23 | backend/open_webui/events.py:112 |
| BUS-020 | auth.mfa.recovery_used | P23 | backend/open_webui/events.py:115 |
| BUS-021 | auth.mfa.recovery_codes_regenerated | P23 | backend/open_webui/events.py:118 |
| BUS-022 | auth.mfa.reset_requested | P23 | backend/open_webui/events.py:123 |
| BUS-023 | auth.mfa.reset_completed | P23 | backend/open_webui/events.py:126 |
| BUS-024 | auth.mfa.policy_changed | P23 | backend/open_webui/events.py:129 |
| BUS-025 | auth.login | P23 | backend/open_webui/events.py:132 |
| BUS-026 | auth.sessions_revoked | P23 | backend/open_webui/events.py:135 |
| BUS-027 | auth.logout | P23 | backend/open_webui/events.py:138 |
| BUS-028 | auth.password_changed | P23 | backend/open_webui/events.py:141 |
| BUS-029 | auth.api_key.created | P23 | backend/open_webui/events.py:144 |
| BUS-030 | auth.api_key.deleted | P23 | backend/open_webui/events.py:147 |
| BUS-031 | auth.oauth_session.deleted | P23 | backend/open_webui/events.py:150 |
| BUS-032 | user.created | P23 | backend/open_webui/events.py:153 |
| BUS-033 | user.updated | P23 | backend/open_webui/events.py:156 |
| BUS-034 | user.deleted | P23 | backend/open_webui/events.py:159 |
| BUS-035 | user.role_updated | P23 | backend/open_webui/events.py:162 |
| BUS-036 | user.status_updated | P23 | backend/open_webui/events.py:165 |
| BUS-037 | user.settings_updated | P23 | backend/open_webui/events.py:168 |
| BUS-038 | user.profile_updated | P23 | backend/open_webui/events.py:171 |
| BUS-039 | user.permissions_updated | P23 | backend/open_webui/events.py:174 |
| BUS-040 | group.created | P23 | backend/open_webui/events.py:179 |
| BUS-041 | group.updated | P23 | backend/open_webui/events.py:182 |
| BUS-042 | group.deleted | P23 | backend/open_webui/events.py:185 |
| BUS-043 | group.member_added | P23 | backend/open_webui/events.py:188 |
| BUS-044 | group.member_removed | P23 | backend/open_webui/events.py:191 |
| BUS-045 | chat.created | P23 | backend/open_webui/events.py:194 |
| BUS-046 | chat.finished | P23 | backend/open_webui/events.py:197 |
| BUS-047 | chat.failed | P23 | backend/open_webui/events.py:200 |
| BUS-048 | chat.imported | P23 | backend/open_webui/events.py:203 |
| BUS-049 | chat.updated | P23 | backend/open_webui/events.py:206 |
| BUS-050 | chat.deleted | P23 | backend/open_webui/events.py:209 |
| BUS-051 | chat.deleted_all | P23 | backend/open_webui/events.py:212 |
| BUS-052 | chat.compacted | P23 | backend/open_webui/events.py:215 |
| BUS-053 | chat.pinned | P23 | backend/open_webui/events.py:218 |
| BUS-054 | chat.unpinned | P23 | backend/open_webui/events.py:221 |
| BUS-055 | chat.cloned | P23 | backend/open_webui/events.py:224 |
| BUS-056 | chat.archived | P23 | backend/open_webui/events.py:227 |
| BUS-057 | chat.unarchived | P23 | backend/open_webui/events.py:230 |
| BUS-058 | chat.shared | P23 | backend/open_webui/events.py:233 |
| BUS-059 | chat.unshared | P23 | backend/open_webui/events.py:236 |
| BUS-060 | chat.folder_updated | P23 | backend/open_webui/events.py:239 |
| BUS-061 | chat.tag_added | P23 | backend/open_webui/events.py:242 |
| BUS-062 | chat.tag_removed | P23 | backend/open_webui/events.py:245 |
| BUS-063 | message.created | P23 | backend/open_webui/events.py:248 |
| BUS-064 | message.updated | P23 | backend/open_webui/events.py:251 |
| BUS-065 | message.deleted | P23 | backend/open_webui/events.py:254 |
| BUS-066 | message.event_received | P23 | backend/open_webui/events.py:257 |
| BUS-067 | message.reaction_added | P23 | backend/open_webui/events.py:262 |
| BUS-068 | message.reaction_removed | P23 | backend/open_webui/events.py:267 |
| BUS-069 | message.pinned | P23 | backend/open_webui/events.py:272 |
| BUS-070 | message.unpinned | P23 | backend/open_webui/events.py:275 |
| BUS-071 | channel.created | P23 | backend/open_webui/events.py:278 |
| BUS-072 | channel.updated | P23 | backend/open_webui/events.py:281 |
| BUS-073 | channel.deleted | P23 | backend/open_webui/events.py:284 |
| BUS-074 | channel.member_added | P23 | backend/open_webui/events.py:287 |
| BUS-075 | channel.member_removed | P23 | backend/open_webui/events.py:290 |
| BUS-076 | channel.member_active_updated | P23 | backend/open_webui/events.py:295 |
| BUS-077 | channel.message | P23 | backend/open_webui/events.py:300 |
| BUS-078 | channel.webhook.created | P23 | backend/open_webui/events.py:305 |
| BUS-079 | channel.webhook.updated | P23 | backend/open_webui/events.py:310 |
| BUS-080 | channel.webhook.deleted | P23 | backend/open_webui/events.py:315 |
| BUS-081 | file.uploaded | P23 | backend/open_webui/events.py:320 |
| BUS-082 | file.content_updated | P23 | backend/open_webui/events.py:323 |
| BUS-083 | file.renamed | P23 | backend/open_webui/events.py:326 |
| BUS-084 | file.deleted | P23 | backend/open_webui/events.py:329 |
| BUS-085 | file.deleted_all | P23 | backend/open_webui/events.py:332 |
| BUS-086 | folder.created | P23 | backend/open_webui/events.py:335 |
| BUS-087 | folder.updated | P23 | backend/open_webui/events.py:338 |
| BUS-088 | folder.parent_updated | P23 | backend/open_webui/events.py:341 |
| BUS-089 | folder.access_updated | P23 | backend/open_webui/events.py:344 |
| BUS-090 | folder.deleted | P23 | backend/open_webui/events.py:347 |
| BUS-091 | note.created | P23 | backend/open_webui/events.py:350 |
| BUS-092 | note.updated | P23 | backend/open_webui/events.py:353 |
| BUS-093 | note.access_updated | P23 | backend/open_webui/events.py:356 |
| BUS-094 | note.pinned | P23 | backend/open_webui/events.py:359 |
| BUS-095 | note.unpinned | P23 | backend/open_webui/events.py:362 |
| BUS-096 | note.deleted | P23 | backend/open_webui/events.py:365 |
| BUS-097 | memory.created | P23 | backend/open_webui/events.py:368 |
| BUS-098 | memory.updated | P23 | backend/open_webui/events.py:371 |
| BUS-099 | memory.deleted | P23 | backend/open_webui/events.py:374 |
| BUS-100 | memory.reset | P23 | backend/open_webui/events.py:377 |
| BUS-101 | knowledge.created | P23 | backend/open_webui/events.py:380 |
| BUS-102 | knowledge.updated | P23 | backend/open_webui/events.py:383 |
| BUS-103 | knowledge.deleted | P23 | backend/open_webui/events.py:386 |
| BUS-104 | knowledge.reset | P23 | backend/open_webui/events.py:389 |
| BUS-105 | knowledge.reindexed | P23 | backend/open_webui/events.py:392 |
| BUS-106 | knowledge.access_updated | P23 | backend/open_webui/events.py:395 |
| BUS-107 | knowledge.file.added | P23 | backend/open_webui/events.py:398 |
| BUS-108 | knowledge.file.updated | P23 | backend/open_webui/events.py:401 |
| BUS-109 | knowledge.file.removed | P23 | backend/open_webui/events.py:404 |
| BUS-110 | knowledge.file.moved | P23 | backend/open_webui/events.py:409 |
| BUS-111 | knowledge.directory.created | P23 | backend/open_webui/events.py:412 |
| BUS-112 | knowledge.directory.updated | P23 | backend/open_webui/events.py:417 |
| BUS-113 | knowledge.directory.deleted | P23 | backend/open_webui/events.py:422 |
| BUS-114 | knowledge.external_connection.created | P23 | backend/open_webui/events.py:427 |
| BUS-115 | knowledge.external_connection.updated | P23 | backend/open_webui/events.py:432 |
| BUS-116 | knowledge.external_connection.deleted | P23 | backend/open_webui/events.py:437 |
| BUS-117 | retrieval.content.processed | P23 | backend/open_webui/events.py:442 |
| BUS-118 | retrieval.content.process_failed | P23 | backend/open_webui/events.py:447 |
| BUS-119 | retrieval.collection.deleted | P23 | backend/open_webui/events.py:452 |
| BUS-120 | retrieval.vector_db.reset | P23 | backend/open_webui/events.py:457 |
| BUS-121 | retrieval.uploads.reset | P23 | backend/open_webui/events.py:462 |
| BUS-122 | model.created | P23 | backend/open_webui/events.py:465 |
| BUS-123 | model.imported | P23 | backend/open_webui/events.py:468 |
| BUS-124 | model.synced | P23 | backend/open_webui/events.py:471 |
| BUS-125 | model.updated | P23 | backend/open_webui/events.py:474 |
| BUS-126 | model.deleted | P23 | backend/open_webui/events.py:477 |
| BUS-127 | model.enabled | P23 | backend/open_webui/events.py:480 |
| BUS-128 | model.disabled | P23 | backend/open_webui/events.py:483 |
| BUS-129 | model.access_updated | P23 | backend/open_webui/events.py:486 |
| BUS-130 | model.provider_config.updated | P23 | backend/open_webui/events.py:489 |
| BUS-131 | model.provider_request.failed | P23 | backend/open_webui/events.py:494 |
| BUS-132 | model.provider_model.created | P23 | backend/open_webui/events.py:499 |
| BUS-133 | model.provider_model.deleted | P23 | backend/open_webui/events.py:504 |
| BUS-134 | function.created | P23 | backend/open_webui/events.py:509 |
| BUS-135 | function.updated | P23 | backend/open_webui/events.py:512 |
| BUS-136 | function.deleted | P23 | backend/open_webui/events.py:515 |
| BUS-137 | function.enabled | P23 | backend/open_webui/events.py:518 |
| BUS-138 | function.disabled | P23 | backend/open_webui/events.py:521 |
| BUS-139 | function.enable_started | P23 | backend/open_webui/events.py:524 |
| BUS-140 | function.disable_started | P23 | backend/open_webui/events.py:529 |
| BUS-141 | function.valves_updated | P23 | backend/open_webui/events.py:534 |
| BUS-142 | tool.created | P23 | backend/open_webui/events.py:537 |
| BUS-143 | tool.updated | P23 | backend/open_webui/events.py:540 |
| BUS-144 | tool.deleted | P23 | backend/open_webui/events.py:543 |
| BUS-145 | tool.access_updated | P23 | backend/open_webui/events.py:546 |
| BUS-146 | tool.valves_updated | P23 | backend/open_webui/events.py:549 |
| BUS-147 | skill.created | P23 | backend/open_webui/events.py:552 |
| BUS-148 | skill.updated | P23 | backend/open_webui/events.py:555 |
| BUS-149 | skill.deleted | P23 | backend/open_webui/events.py:558 |
| BUS-150 | skill.enabled | P23 | backend/open_webui/events.py:561 |
| BUS-151 | skill.disabled | P23 | backend/open_webui/events.py:564 |
| BUS-152 | prompt.created | P23 | backend/open_webui/events.py:567 |
| BUS-153 | prompt.updated | P23 | backend/open_webui/events.py:570 |
| BUS-154 | prompt.deleted | P23 | backend/open_webui/events.py:573 |
| BUS-155 | prompt.enabled | P23 | backend/open_webui/events.py:576 |
| BUS-156 | prompt.disabled | P23 | backend/open_webui/events.py:579 |
| BUS-157 | prompt.version_updated | P23 | backend/open_webui/events.py:582 |
| BUS-158 | prompt.access_updated | P23 | backend/open_webui/events.py:585 |
| BUS-159 | pipeline.uploaded | P23 | backend/open_webui/events.py:588 |
| BUS-160 | pipeline.added | P23 | backend/open_webui/events.py:591 |
| BUS-161 | pipeline.deleted | P23 | backend/open_webui/events.py:594 |
| BUS-162 | pipeline.valves_updated | P23 | backend/open_webui/events.py:597 |
| BUS-163 | calendar.created | P23 | backend/open_webui/events.py:600 |
| BUS-164 | calendar.updated | P23 | backend/open_webui/events.py:603 |
| BUS-165 | calendar.deleted | P23 | backend/open_webui/events.py:606 |
| BUS-166 | calendar.default_updated | P23 | backend/open_webui/events.py:609 |
| BUS-167 | calendar.event.created | P23 | backend/open_webui/events.py:614 |
| BUS-168 | calendar.event.updated | P23 | backend/open_webui/events.py:617 |
| BUS-169 | calendar.event.deleted | P23 | backend/open_webui/events.py:620 |
| BUS-170 | calendar.event.rsvp_updated | P23 | backend/open_webui/events.py:623 |
| BUS-171 | calendar.alert | P23 | backend/open_webui/events.py:628 |
| BUS-172 | automation.created | P23 | backend/open_webui/events.py:633 |
| BUS-173 | automation.updated | P23 | backend/open_webui/events.py:636 |
| BUS-174 | automation.enabled | P23 | backend/open_webui/events.py:639 |
| BUS-175 | automation.disabled | P23 | backend/open_webui/events.py:642 |
| BUS-176 | automation.deleted | P23 | backend/open_webui/events.py:645 |
| BUS-177 | automation.run_started | P23 | backend/open_webui/events.py:648 |
| BUS-178 | automation.run_completed | P23 | backend/open_webui/events.py:651 |
| BUS-179 | automation.run_failed | P23 | backend/open_webui/events.py:654 |
| BUS-180 | feedback.created | P23 | backend/open_webui/events.py:657 |
| BUS-181 | feedback.updated | P23 | backend/open_webui/events.py:660 |
| BUS-182 | feedback.deleted | P23 | backend/open_webui/events.py:663 |
| BUS-183 | feedback.deleted_all | P23 | backend/open_webui/events.py:666 |
| BUS-184 | image.generated | P23 | backend/open_webui/events.py:669 |
| BUS-185 | image.edited | P23 | backend/open_webui/events.py:672 |
| BUS-186 | audio.speech_requested | P23 | backend/open_webui/events.py:675 |
| BUS-187 | audio.transcription_requested | P23 | backend/open_webui/events.py:678 |
| BUS-188 | terminal.session.opened | P23 | backend/open_webui/events.py:683 |
| BUS-189 | terminal.session.closed | P23 | backend/open_webui/events.py:686 |
| BUS-190 | notification.test | P23 | backend/open_webui/events.py:689 |
| BUS-191 | notification.manual | P23 | backend/open_webui/events.py:692 |

## Payload shape index

Inherited fields and validators must be resolved by contract task; annotation/default descriptors exist in inventory.json.

| ID | Shape | Bases | Field count | Owner | Source |
|---|---|---|---:|---|---|
| SHAPE-0001 | BannerModel | BaseModel | 7 | P23 | backend/open_webui/config.py:2168 |
| SHAPE-0002 | EventDefinition | BaseModel | 3 | P00 | backend/open_webui/events.py:26 |
| SHAPE-0003 | EventDefinitions | BaseModel | 191 | P00 | backend/open_webui/events.py:43 |
| SHAPE-0004 | Event | BaseModel | 13 | P00 | backend/open_webui/events.py:958 |
| SHAPE-0005 | ModelUnloadForm | BaseModel | 1 | P00 | backend/open_webui/main.py:980 |
| SHAPE-0006 | EventWebhookForm | BaseModel | 5 | P00 | backend/open_webui/main.py:2547 |
| SHAPE-0007 | EventWebhookUpdateForm | BaseModel | 5 | P00 | backend/open_webui/main.py:2555 |
| SHAPE-0008 | AccessGrantModel | BaseModel | 7 | P03 | backend/open_webui/models/access_grants.py:48 |
| SHAPE-0009 | AccessGrantResponse | BaseModel | 4 | P03 | backend/open_webui/models/access_grants.py:60 |
| SHAPE-0010 | MfaLimit | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:40 |
| SHAPE-0011 | MfaResetTicket | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:45 |
| SHAPE-0012 | MfaChallenge | BaseModel | 10 | P02 | backend/open_webui/models/auths.py:50 |
| SHAPE-0013 | MfaData | BaseModel | 9 | P02 | backend/open_webui/models/auths.py:63 |
| SHAPE-0014 | AuthModel | BaseModel | 6 | P02 | backend/open_webui/models/auths.py:77 |
| SHAPE-0015 | Token | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:90 |
| SHAPE-0016 | ApiKey | BaseModel | 1 | P02 | backend/open_webui/models/auths.py:97 |
| SHAPE-0017 | SigninResponse | Token, UserProfileImageResponse | 0 | P02 | backend/open_webui/models/auths.py:101 |
| SHAPE-0018 | SessionUserResponse | Token, UserProfileImageResponse | 2 | P02 | backend/open_webui/models/auths.py:105 |
| SHAPE-0019 | SessionUserInfoResponse | SessionUserResponse, UserStatus | 3 | P02 | backend/open_webui/models/auths.py:110 |
| SHAPE-0020 | AddUserResponse | UserProfileImageResponse | 2 | P02 | backend/open_webui/models/auths.py:116 |
| SHAPE-0021 | MfaChallengeResponse | BaseModel | 3 | P02 | backend/open_webui/models/auths.py:121 |
| SHAPE-0022 | PendingUserResponse | BaseModel | 1 | P02 | backend/open_webui/models/auths.py:127 |
| SHAPE-0023 | MfaStatusResponse | BaseModel | 3 | P02 | backend/open_webui/models/auths.py:131 |
| SHAPE-0024 | MfaSetupResponse | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:137 |
| SHAPE-0025 | MfaRecoveryCodesResponse | BaseModel | 1 | P02 | backend/open_webui/models/auths.py:142 |
| SHAPE-0026 | MfaEnrollmentResponse | SessionUserResponse | 1 | P02 | backend/open_webui/models/auths.py:146 |
| SHAPE-0027 | MfaChallengeForm | BaseModel | 1 | P02 | backend/open_webui/models/auths.py:150 |
| SHAPE-0028 | MfaVerifyForm | MfaChallengeForm | 2 | P02 | backend/open_webui/models/auths.py:155 |
| SHAPE-0029 | MfaFactorForm | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:160 |
| SHAPE-0030 | MfaRecoveryForm | MfaChallengeForm | 1 | P02 | backend/open_webui/models/auths.py:166 |
| SHAPE-0031 | SigninForm | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:173 |
| SHAPE-0032 | LdapForm | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:178 |
| SHAPE-0033 | ProfileImageUrlForm | BaseModel | 1 | P02 | backend/open_webui/models/auths.py:183 |
| SHAPE-0034 | UpdatePasswordForm | BaseModel | 2 | P02 | backend/open_webui/models/auths.py:187 |
| SHAPE-0035 | SignupForm | BaseModel | 4 | P02 | backend/open_webui/models/auths.py:192 |
| SHAPE-0036 | AddUserForm | SignupForm | 1 | P02 | backend/open_webui/models/auths.py:206 |
| SHAPE-0037 | AutomationTerminalConfig | BaseModel | 2 | P20 | backend/open_webui/models/automations.py:63 |
| SHAPE-0038 | AutomationTarget | BaseModel | 2 | P20 | backend/open_webui/models/automations.py:68 |
| SHAPE-0039 | AutomationData | BaseModel | 5 | P20 | backend/open_webui/models/automations.py:73 |
| SHAPE-0040 | AutomationModel | BaseModel | 11 | P20 | backend/open_webui/models/automations.py:81 |
| SHAPE-0041 | AutomationRunModel | BaseModel | 6 | P20 | backend/open_webui/models/automations.py:98 |
| SHAPE-0042 | AutomationForm | BaseModel | 5 | P20 | backend/open_webui/models/automations.py:109 |
| SHAPE-0043 | AutomationResponse | AutomationModel | 2 | P20 | backend/open_webui/models/automations.py:117 |
| SHAPE-0044 | AutomationListResponse | BaseModel | 2 | P20 | backend/open_webui/models/automations.py:122 |
| SHAPE-0045 | CalendarModel | BaseModel | 11 | P19 | backend/open_webui/models/calendar.py:105 |
| SHAPE-0046 | CalendarEventModel | BaseModel | 17 | P19 | backend/open_webui/models/calendar.py:124 |
| SHAPE-0047 | CalendarEventAttendeeModel | BaseModel | 7 | P19 | backend/open_webui/models/calendar.py:148 |
| SHAPE-0048 | CalendarForm | BaseModel | 5 | P19 | backend/open_webui/models/calendar.py:166 |
| SHAPE-0049 | CalendarUpdateForm | BaseModel | 5 | P19 | backend/open_webui/models/calendar.py:174 |
| SHAPE-0050 | CalendarEventForm | BaseModel | 12 | P19 | backend/open_webui/models/calendar.py:196 |
| SHAPE-0051 | CalendarEventUpdateForm | BaseModel | 13 | P19 | backend/open_webui/models/calendar.py:211 |
| SHAPE-0052 | RSVPForm | BaseModel | 1 | P19 | backend/open_webui/models/calendar.py:227 |
| SHAPE-0053 | CalendarEventUserResponse | CalendarEventModel | 1 | P19 | backend/open_webui/models/calendar.py:236 |
| SHAPE-0054 | CalendarEventListResponse | BaseModel | 2 | P19 | backend/open_webui/models/calendar.py:240 |
| SHAPE-0055 | ChannelModel | BaseModel | 16 | P17 | backend/open_webui/models/channels.py:68 |
| SHAPE-0056 | ChannelMemberModel | BaseModel | 17 | P17 | backend/open_webui/models/channels.py:127 |
| SHAPE-0057 | ChannelFileModel | BaseModel | 6 | P17 | backend/open_webui/models/channels.py:173 |
| SHAPE-0058 | ChannelWebhookModel | BaseModel | 9 | P17 | backend/open_webui/models/channels.py:203 |
| SHAPE-0059 | ChannelResponse | ChannelModel | 3 | P17 | backend/open_webui/models/channels.py:225 |
| SHAPE-0060 | ChannelForm | BaseModel | 8 | P17 | backend/open_webui/models/channels.py:232 |
| SHAPE-0061 | CreateChannelForm | ChannelForm | 1 | P17 | backend/open_webui/models/channels.py:243 |
| SHAPE-0062 | ChannelWebhookForm | BaseModel | 2 | P17 | backend/open_webui/models/channels.py:247 |
| SHAPE-0063 | ChatMessageModel | BaseModel | 19 | P05 | backend/open_webui/models/chat_messages.py:183 |
| SHAPE-0064 | ChatModel | BaseModel | 17 | P06 | backend/open_webui/models/chats.py:188 |
| SHAPE-0065 | ChatFileModel | BaseModel | 7 | P06 | backend/open_webui/models/chats.py:235 |
| SHAPE-0066 | ChatForm | BaseModel | 3 | P06 | backend/open_webui/models/chats.py:254 |
| SHAPE-0067 | ChatImportForm | ChatForm | 6 | P06 | backend/open_webui/models/chats.py:260 |
| SHAPE-0068 | ChatsImportForm | BaseModel | 1 | P06 | backend/open_webui/models/chats.py:269 |
| SHAPE-0069 | ChatTitleForm | BaseModel | 1 | P06 | backend/open_webui/models/chats.py:273 |
| SHAPE-0070 | ChatResponse | BaseModel | 16 | P06 | backend/open_webui/models/chats.py:277 |
| SHAPE-0071 | ChatTitleIdResponse | BaseModel | 8 | P06 | backend/open_webui/models/chats.py:302 |
| SHAPE-0072 | SharedChatResponse | BaseModel | 5 | P06 | backend/open_webui/models/chats.py:313 |
| SHAPE-0073 | ChatListResponse | BaseModel | 2 | P06 | backend/open_webui/models/chats.py:321 |
| SHAPE-0074 | ChatUsageStatsResponse | BaseModel | 14 | P06 | backend/open_webui/models/chats.py:326 |
| SHAPE-0075 | ChatUsageStatsListResponse | BaseModel | 2 | P06 | backend/open_webui/models/chats.py:350 |
| SHAPE-0076 | MessageStats | BaseModel | 8 | P06 | backend/open_webui/models/chats.py:356 |
| SHAPE-0077 | ChatHistoryStats | BaseModel | 2 | P06 | backend/open_webui/models/chats.py:367 |
| SHAPE-0078 | ChatBody | BaseModel | 1 | P06 | backend/open_webui/models/chats.py:372 |
| SHAPE-0079 | AggregateChatStats | BaseModel | 9 | P06 | backend/open_webui/models/chats.py:376 |
| SHAPE-0080 | ChatStatsExport | BaseModel | 7 | P06 | backend/open_webui/models/chats.py:388 |
| SHAPE-0081 | FeedbackModel | BaseModel | 9 | P22 | backend/open_webui/models/feedbacks.py:33 |
| SHAPE-0082 | FeedbackResponse | BaseModel | 8 | P22 | backend/open_webui/models/feedbacks.py:52 |
| SHAPE-0083 | FeedbackIdResponse | BaseModel | 4 | P22 | backend/open_webui/models/feedbacks.py:63 |
| SHAPE-0084 | LeaderboardFeedbackData | BaseModel | 2 | P22 | backend/open_webui/models/feedbacks.py:70 |
| SHAPE-0085 | RatingData | BaseModel | 5 | P22 | backend/open_webui/models/feedbacks.py:77 |
| SHAPE-0086 | MetaData | BaseModel | 4 | P22 | backend/open_webui/models/feedbacks.py:86 |
| SHAPE-0087 | SnapshotData | BaseModel | 1 | P22 | backend/open_webui/models/feedbacks.py:94 |
| SHAPE-0088 | FeedbackForm | BaseModel | 4 | P22 | backend/open_webui/models/feedbacks.py:99 |
| SHAPE-0089 | UserResponse | BaseModel | 7 | P22 | backend/open_webui/models/feedbacks.py:108 |
| SHAPE-0090 | FeedbackUserResponse | FeedbackResponse | 1 | P22 | backend/open_webui/models/feedbacks.py:121 |
| SHAPE-0091 | FeedbackListResponse | BaseModel | 2 | P22 | backend/open_webui/models/feedbacks.py:125 |
| SHAPE-0092 | ModelHistoryEntry | BaseModel | 3 | P22 | backend/open_webui/models/feedbacks.py:130 |
| SHAPE-0093 | ModelHistoryCounts | BaseModel | 3 | P22 | backend/open_webui/models/feedbacks.py:136 |
| SHAPE-0094 | ModelHistoryResponse | BaseModel | 2 | P22 | backend/open_webui/models/feedbacks.py:142 |
| SHAPE-0095 | FileModel | BaseModel | 9 | P09 | backend/open_webui/models/files.py:34 |
| SHAPE-0096 | FileMeta | BaseModel | 3 | P09 | backend/open_webui/models/files.py:52 |
| SHAPE-0097 | FileModelResponse | BaseModel | 8 | P09 | backend/open_webui/models/files.py:77 |
| SHAPE-0098 | FileMetadataResponse | BaseModel | 5 | P09 | backend/open_webui/models/files.py:92 |
| SHAPE-0099 | FileListResponse | BaseModel | 2 | P09 | backend/open_webui/models/files.py:100 |
| SHAPE-0100 | FileForm | BaseModel | 6 | P09 | backend/open_webui/models/files.py:105 |
| SHAPE-0101 | FileUpdateForm | BaseModel | 3 | P09 | backend/open_webui/models/files.py:114 |
| SHAPE-0102 | FolderModel | BaseModel | 10 | P06 | backend/open_webui/models/folders.py:36 |
| SHAPE-0103 | FolderMetadataResponse | BaseModel | 1 | P06 | backend/open_webui/models/folders.py:51 |
| SHAPE-0104 | FolderNameIdResponse | BaseModel | 8 | P06 | backend/open_webui/models/folders.py:55 |
| SHAPE-0105 | SharedFolderResponse | BaseModel | 11 | P06 | backend/open_webui/models/folders.py:66 |
| SHAPE-0106 | FolderForm | BaseModel | 4 | P06 | backend/open_webui/models/folders.py:85 |
| SHAPE-0107 | FolderUpdateForm | BaseModel | 3 | P06 | backend/open_webui/models/folders.py:93 |
| SHAPE-0108 | FunctionHistoryResponse | BaseModel | 7 | P12 | backend/open_webui/models/function_history.py:25 |
| SHAPE-0109 | FunctionHistoryModel | FunctionHistoryResponse | 1 | P12 | backend/open_webui/models/function_history.py:36 |
| SHAPE-0110 | FunctionMeta | BaseModel | 2 | P12 | backend/open_webui/models/functions.py:40 |
| SHAPE-0111 | FunctionModel | BaseModel | 11 | P12 | backend/open_webui/models/functions.py:46 |
| SHAPE-0112 | FunctionWithValvesModel | BaseModel | 12 | P12 | backend/open_webui/models/functions.py:63 |
| SHAPE-0113 | FunctionResponse | BaseModel | 10 | P12 | backend/open_webui/models/functions.py:85 |
| SHAPE-0114 | FunctionUserResponse | FunctionResponse | 1 | P12 | backend/open_webui/models/functions.py:100 |
| SHAPE-0115 | FunctionForm | BaseModel | 5 | P12 | backend/open_webui/models/functions.py:104 |
| SHAPE-0116 | FunctionValves | BaseModel | 1 | P12 | backend/open_webui/models/functions.py:112 |
| SHAPE-0117 | GroupModel | BaseModel | 10 | P03 | backend/open_webui/models/groups.py:62 |
| SHAPE-0118 | GroupMemberModel | BaseModel | 5 | P03 | backend/open_webui/models/groups.py:97 |
| SHAPE-0119 | GroupResponse | GroupModel | 1 | P03 | backend/open_webui/models/groups.py:110 |
| SHAPE-0120 | GroupInfoResponse | BaseModel | 8 | P03 | backend/open_webui/models/groups.py:114 |
| SHAPE-0121 | GroupForm | BaseModel | 5 | P03 | backend/open_webui/models/groups.py:125 |
| SHAPE-0122 | UserIdsForm | BaseModel | 1 | P03 | backend/open_webui/models/groups.py:148 |
| SHAPE-0123 | GroupUpdateForm | GroupForm | 0 | P03 | backend/open_webui/models/groups.py:152 |
| SHAPE-0124 | GroupListResponse | BaseModel | 2 | P03 | backend/open_webui/models/groups.py:156 |
| SHAPE-0125 | KnowledgeModel | BaseModel | 8 | P13 | backend/open_webui/models/knowledge.py:82 |
| SHAPE-0126 | KnowledgeFileModel | BaseModel | 7 | P13 | backend/open_webui/models/knowledge.py:118 |
| SHAPE-0127 | KnowledgeDirectoryModel | BaseModel | 7 | P13 | backend/open_webui/models/knowledge.py:131 |
| SHAPE-0128 | KnowledgeDirectoryForm | BaseModel | 2 | P13 | backend/open_webui/models/knowledge.py:144 |
| SHAPE-0129 | KnowledgeUserModel | KnowledgeModel | 2 | P13 | backend/open_webui/models/knowledge.py:152 |
| SHAPE-0130 | KnowledgeResponse | KnowledgeModel | 1 | P13 | backend/open_webui/models/knowledge.py:157 |
| SHAPE-0131 | KnowledgeUserResponse | KnowledgeUserModel | 0 | P13 | backend/open_webui/models/knowledge.py:161 |
| SHAPE-0132 | KnowledgeForm | BaseModel | 3 | P13 | backend/open_webui/models/knowledge.py:165 |
| SHAPE-0133 | FileUserResponse | FileModelResponse | 4 | P13 | backend/open_webui/models/knowledge.py:171 |
| SHAPE-0134 | KnowledgeListResponse | BaseModel | 2 | P13 | backend/open_webui/models/knowledge.py:178 |
| SHAPE-0135 | KnowledgeFileListResponse | BaseModel | 4 | P13 | backend/open_webui/models/knowledge.py:183 |
| SHAPE-0136 | MemoryModel | BaseModel | 8 | P14 | backend/open_webui/models/memories.py:31 |
| SHAPE-0137 | MessageReactionModel | BaseModel | 5 | P17 | backend/open_webui/models/messages.py:28 |
| SHAPE-0138 | MessageModel | BaseModel | 13 | P17 | backend/open_webui/models/messages.py:61 |
| SHAPE-0139 | MessageForm | BaseModel | 6 | P17 | backend/open_webui/models/messages.py:89 |
| SHAPE-0140 | Reactions | BaseModel | 3 | P17 | backend/open_webui/models/messages.py:98 |
| SHAPE-0141 | MessageUserResponse | MessageModel | 1 | P17 | backend/open_webui/models/messages.py:104 |
| SHAPE-0142 | MessageUserSlimResponse | MessageUserResponse | 1 | P17 | backend/open_webui/models/messages.py:108 |
| SHAPE-0143 | MessageReplyToResponse | MessageUserResponse | 1 | P17 | backend/open_webui/models/messages.py:121 |
| SHAPE-0144 | MessageWithReactionsResponse | MessageUserSlimResponse | 1 | P17 | backend/open_webui/models/messages.py:125 |
| SHAPE-0145 | MessageResponse | MessageReplyToResponse | 3 | P17 | backend/open_webui/models/messages.py:129 |
| SHAPE-0146 | ModelHistoryResponse | BaseModel | 7 | P10 | backend/open_webui/models/model_history.py:39 |
| SHAPE-0147 | ModelHistoryModel | ModelHistoryResponse | 1 | P10 | backend/open_webui/models/model_history.py:50 |
| SHAPE-0148 | ModelControlOption | BaseModel | 2 | P10 | backend/open_webui/models/models.py:74 |
| SHAPE-0149 | ModelControl | BaseModel | 5 | P10 | backend/open_webui/models/models.py:81 |
| SHAPE-0150 | ModelParams | BaseModel | 1 | P10 | backend/open_webui/models/models.py:97 |
| SHAPE-0151 | ModelVoice | BaseModel | 1 | P10 | backend/open_webui/models/models.py:107 |
| SHAPE-0152 | ModelAvatarAnimation | BaseModel | 1 | P10 | backend/open_webui/models/models.py:111 |
| SHAPE-0153 | ModelVoiceAvatar | BaseModel | 3 | P10 | backend/open_webui/models/models.py:121 |
| SHAPE-0154 | ModelMeta | BaseModel | 8 | P10 | backend/open_webui/models/models.py:143 |
| SHAPE-0155 | ModelModel | BaseModel | 11 | P10 | backend/open_webui/models/models.py:199 |
| SHAPE-0156 | ModelUserResponse | ModelModel | 1 | P10 | backend/open_webui/models/models.py:220 |
| SHAPE-0157 | ModelAccessResponse | ModelUserResponse | 1 | P10 | backend/open_webui/models/models.py:224 |
| SHAPE-0158 | ModelResponse | ModelModel | 0 | P10 | backend/open_webui/models/models.py:228 |
| SHAPE-0159 | ModelListResponse | BaseModel | 2 | P10 | backend/open_webui/models/models.py:232 |
| SHAPE-0160 | ModelAccessListResponse | BaseModel | 2 | P10 | backend/open_webui/models/models.py:237 |
| SHAPE-0161 | ModelForm | BaseModel | 8 | P10 | backend/open_webui/models/models.py:242 |
| SHAPE-0162 | NoteModel | BaseModel | 9 | P18 | backend/open_webui/models/notes.py:60 |
| SHAPE-0163 | NoteForm | BaseModel | 4 | P18 | backend/open_webui/models/notes.py:96 |
| SHAPE-0164 | NoteUpdateForm | BaseModel | 4 | P18 | backend/open_webui/models/notes.py:108 |
| SHAPE-0165 | NoteUserResponse | NoteModel | 1 | P18 | backend/open_webui/models/notes.py:120 |
| SHAPE-0166 | NoteItemResponse | BaseModel | 7 | P18 | backend/open_webui/models/notes.py:124 |
| SHAPE-0167 | NoteListResponse | BaseModel | 2 | P18 | backend/open_webui/models/notes.py:134 |
| SHAPE-0168 | OAuthSessionModel | BaseModel | 7 | P02 | backend/open_webui/models/oauth_sessions.py:42 |
| SHAPE-0169 | OAuthSessionResponse | BaseModel | 4 | P02 | backend/open_webui/models/oauth_sessions.py:59 |
| SHAPE-0170 | PromptHistoryModel | BaseModel | 7 | P11 | backend/open_webui/models/prompt_history.py:31 |
| SHAPE-0171 | PromptHistoryResponse | PromptHistoryModel | 1 | P11 | backend/open_webui/models/prompt_history.py:43 |
| SHAPE-0172 | PromptModel | BaseModel | 13 | P11 | backend/open_webui/models/prompts.py:42 |
| SHAPE-0173 | PromptUserResponse | PromptModel | 1 | P11 | backend/open_webui/models/prompts.py:65 |
| SHAPE-0174 | PromptAccessResponse | PromptUserResponse | 1 | P11 | backend/open_webui/models/prompts.py:69 |
| SHAPE-0175 | PromptListResponse | BaseModel | 2 | P11 | backend/open_webui/models/prompts.py:73 |
| SHAPE-0176 | PromptAccessListResponse | BaseModel | 2 | P11 | backend/open_webui/models/prompts.py:78 |
| SHAPE-0177 | PromptForm | BaseModel | 10 | P11 | backend/open_webui/models/prompts.py:83 |
| SHAPE-0178 | ShareChatForm | BaseModel | 1 | P06 | backend/open_webui/models/shared_chats.py:16 |
| SHAPE-0179 | SharedChatModel | BaseModel | 7 | P06 | backend/open_webui/models/shared_chats.py:39 |
| SHAPE-0180 | SharedChatResponse | BaseModel | 6 | P06 | backend/open_webui/models/shared_chats.py:53 |
| SHAPE-0181 | SkillHistoryModel | BaseModel | 7 | P11 | backend/open_webui/models/skill_history.py:21 |
| SHAPE-0182 | SkillHistoryResponse | BaseModel | 7 | P11 | backend/open_webui/models/skill_history.py:32 |
| SHAPE-0183 | SkillMeta | BaseModel | 2 | P11 | backend/open_webui/models/skills.py:41 |
| SHAPE-0184 | SkillModel | BaseModel | 12 | P11 | backend/open_webui/models/skills.py:46 |
| SHAPE-0185 | SkillUserModel | SkillModel | 1 | P11 | backend/open_webui/models/skills.py:69 |
| SHAPE-0186 | SkillResponse | BaseModel | 10 | P11 | backend/open_webui/models/skills.py:73 |
| SHAPE-0187 | SkillUserResponse | SkillResponse | 1 | P11 | backend/open_webui/models/skills.py:86 |
| SHAPE-0188 | SkillAccessResponse | SkillUserResponse | 1 | P11 | backend/open_webui/models/skills.py:92 |
| SHAPE-0189 | SkillDetailResponse | SkillAccessResponse | 1 | P11 | backend/open_webui/models/skills.py:96 |
| SHAPE-0190 | SkillData | BaseModel | 1 | P11 | backend/open_webui/models/skills.py:100 |
| SHAPE-0191 | SkillForm | BaseModel | 12 | P11 | backend/open_webui/models/skills.py:105 |
| SHAPE-0192 | SkillListResponse | BaseModel | 2 | P11 | backend/open_webui/models/skills.py:120 |
| SHAPE-0193 | SkillAccessListResponse | BaseModel | 2 | P11 | backend/open_webui/models/skills.py:125 |
| SHAPE-0194 | TagModel | BaseModel | 4 | P06 | backend/open_webui/models/tags.py:34 |
| SHAPE-0195 | TagChatIdForm | BaseModel | 2 | P06 | backend/open_webui/models/tags.py:47 |
| SHAPE-0196 | ToolHistoryResponse | BaseModel | 7 | P12 | backend/open_webui/models/tool_history.py:25 |
| SHAPE-0197 | ToolHistoryModel | ToolHistoryResponse | 1 | P12 | backend/open_webui/models/tool_history.py:36 |
| SHAPE-0198 | ToolMeta | BaseModel | 4 | P12 | backend/open_webui/models/tools.py:39 |
| SHAPE-0199 | ToolModel | BaseModel | 10 | P12 | backend/open_webui/models/tools.py:47 |
| SHAPE-0200 | ToolUserModel | ToolModel | 1 | P12 | backend/open_webui/models/tools.py:69 |
| SHAPE-0201 | ToolResponse | BaseModel | 8 | P12 | backend/open_webui/models/tools.py:73 |
| SHAPE-0202 | ToolUserResponse | ToolResponse | 1 | P12 | backend/open_webui/models/tools.py:84 |
| SHAPE-0203 | ToolAccessResponse | ToolUserResponse | 1 | P12 | backend/open_webui/models/tools.py:90 |
| SHAPE-0204 | ToolForm | BaseModel | 6 | P12 | backend/open_webui/models/tools.py:94 |
| SHAPE-0205 | ToolValves | BaseModel | 1 | P12 | backend/open_webui/models/tools.py:103 |
| SHAPE-0206 | InterfaceTitleSettings | BaseModel | 1 | P02 | backend/open_webui/models/users.py:45 |
| SHAPE-0207 | InterfaceImageCompressionSize | BaseModel | 2 | P02 | backend/open_webui/models/users.py:51 |
| SHAPE-0208 | InterfaceFloatingActionButton | BaseModel | 4 | P02 | backend/open_webui/models/users.py:58 |
| SHAPE-0209 | InterfaceSettings | BaseModel | 61 | P02 | backend/open_webui/models/users.py:67 |
| SHAPE-0210 | UserSettings | BaseModel | 1 | P02 | backend/open_webui/models/users.py:136 |
| SHAPE-0211 | UserModel | BaseModel | 23 | P02 | backend/open_webui/models/users.py:182 |
| SHAPE-0212 | UserStatusModel | UserModel | 1 | P02 | backend/open_webui/models/users.py:233 |
| SHAPE-0213 | ApiKeyModel | BaseModel | 8 | P02 | backend/open_webui/models/users.py:252 |
| SHAPE-0214 | UpdateProfileForm | BaseModel | 5 | P02 | backend/open_webui/models/users.py:270 |
| SHAPE-0215 | UserGroupIdsModel | UserModel | 1 | P02 | backend/open_webui/models/users.py:283 |
| SHAPE-0216 | UserModelResponse | UserModel | 0 | P02 | backend/open_webui/models/users.py:287 |
| SHAPE-0217 | UserListResponse | BaseModel | 2 | P02 | backend/open_webui/models/users.py:291 |
| SHAPE-0218 | UserGroupIdsListResponse | BaseModel | 2 | P02 | backend/open_webui/models/users.py:296 |
| SHAPE-0219 | UserStatus | BaseModel | 3 | P02 | backend/open_webui/models/users.py:301 |
| SHAPE-0220 | UserIdNameResponse | BaseModel | 2 | P02 | backend/open_webui/models/users.py:319 |
| SHAPE-0221 | UserInfoListResponse | BaseModel | 2 | P02 | backend/open_webui/models/users.py:330 |
| SHAPE-0222 | UserIdNameListResponse | BaseModel | 2 | P02 | backend/open_webui/models/users.py:335 |
| SHAPE-0223 | UserNameResponse | BaseModel | 3 | P02 | backend/open_webui/models/users.py:340 |
| SHAPE-0224 | UserResponse | UserNameResponse | 1 | P02 | backend/open_webui/models/users.py:346 |
| SHAPE-0225 | UserProfileImageResponse | UserNameResponse | 2 | P02 | backend/open_webui/models/users.py:350 |
| SHAPE-0226 | UserRoleUpdateForm | BaseModel | 2 | P02 | backend/open_webui/models/users.py:355 |
| SHAPE-0227 | UserUpdateForm | BaseModel | 5 | P02 | backend/open_webui/models/users.py:360 |
| SHAPE-0228 | VectorItem | BaseModel | 4 | P13 | backend/open_webui/retrieval/vector/main.py:7 |
| SHAPE-0229 | GetResult | BaseModel | 3 | P13 | backend/open_webui/retrieval/vector/main.py:14 |
| SHAPE-0230 | SearchResult | BaseModel | 3 | P14 | backend/open_webui/retrieval/web/main.py:47 |
| SHAPE-0231 | ModelAnalyticsEntry | BaseModel | 4 | P22 | backend/open_webui/routers/analytics.py:28 |
| SHAPE-0232 | ModelAnalyticsResponse | BaseModel | 1 | P22 | backend/open_webui/routers/analytics.py:35 |
| SHAPE-0233 | UserAnalyticsEntry | BaseModel | 7 | P22 | backend/open_webui/routers/analytics.py:39 |
| SHAPE-0234 | UserAnalyticsResponse | BaseModel | 1 | P22 | backend/open_webui/routers/analytics.py:49 |
| SHAPE-0235 | SummaryResponse | BaseModel | 4 | P22 | backend/open_webui/routers/analytics.py:156 |
| SHAPE-0236 | DailyStatsEntry | BaseModel | 2 | P22 | backend/open_webui/routers/analytics.py:190 |
| SHAPE-0237 | DailyStatsResponse | BaseModel | 1 | P22 | backend/open_webui/routers/analytics.py:195 |
| SHAPE-0238 | TokenUsageEntry | BaseModel | 5 | P22 | backend/open_webui/routers/analytics.py:222 |
| SHAPE-0239 | TokenUsageResponse | BaseModel | 4 | P22 | backend/open_webui/routers/analytics.py:230 |
| SHAPE-0240 | ModelChatEntry | BaseModel | 5 | P22 | backend/open_webui/routers/analytics.py:271 |
| SHAPE-0241 | ModelChatsResponse | BaseModel | 2 | P22 | backend/open_webui/routers/analytics.py:279 |
| SHAPE-0242 | HistoryEntry | BaseModel | 3 | P22 | backend/open_webui/routers/analytics.py:329 |
| SHAPE-0243 | TagEntry | BaseModel | 2 | P22 | backend/open_webui/routers/analytics.py:335 |
| SHAPE-0244 | ModelOverviewResponse | BaseModel | 2 | P22 | backend/open_webui/routers/analytics.py:340 |
| SHAPE-0245 | TTSConfigForm | BaseModel | 14 | P15 | backend/open_webui/routers/audio/__init__.py:257 |
| SHAPE-0246 | STTConfigForm | BaseModel | 17 | P15 | backend/open_webui/routers/audio/__init__.py:274 |
| SHAPE-0247 | RealtimeConfigForm | BaseModel | 7 | P15 | backend/open_webui/routers/audio/__init__.py:294 |
| SHAPE-0248 | AudioConfigUpdateForm | BaseModel | 3 | P15 | backend/open_webui/routers/audio/__init__.py:304 |
| SHAPE-0249 | UpdateTimezoneForm | BaseModel | 1 | P02 | backend/open_webui/routers/auths.py:275 |
| SHAPE-0250 | AdminConfig | MfaConfigForm | 31 | P02 | backend/open_webui/routers/auths.py:1158 |
| SHAPE-0251 | LdapServerConfig | BaseModel | 16 | P02 | backend/open_webui/routers/auths.py:1251 |
| SHAPE-0252 | LdapConfigForm | BaseModel | 1 | P02 | backend/open_webui/routers/auths.py:1306 |
| SHAPE-0253 | OAuthConfigForm | BaseModel | 34 | P02 | backend/open_webui/routers/auths.py:1321 |
| SHAPE-0254 | OAuthConfigResponse | OAuthConfigForm | 1 | P02 | backend/open_webui/routers/auths.py:1454 |
| SHAPE-0255 | TokenExchangeForm | BaseModel | 1 | P02 | backend/open_webui/routers/auths.py:1541 |
| SHAPE-0256 | ChannelListItemResponse | ChannelModel | 4 | P17 | backend/open_webui/routers/channels.py:165 |
| SHAPE-0257 | ChannelFullResponse | ChannelResponse | 4 | P17 | backend/open_webui/routers/channels.py:377 |
| SHAPE-0258 | ChannelMemberResponse | BaseModel | 10 | P17 | backend/open_webui/routers/channels.py:481 |
| SHAPE-0259 | ChannelMemberListResponse | BaseModel | 2 | P17 | backend/open_webui/routers/channels.py:494 |
| SHAPE-0260 | UpdateActiveMemberForm | BaseModel | 1 | P17 | backend/open_webui/routers/channels.py:588 |
| SHAPE-0261 | UpdateMembersForm | BaseModel | 2 | P17 | backend/open_webui/routers/channels.py:624 |
| SHAPE-0262 | RemoveMembersForm | BaseModel | 1 | P17 | backend/open_webui/routers/channels.py:679 |
| SHAPE-0263 | MessageUserResponse | MessageResponse | 1 | P17 | backend/open_webui/routers/channels.py:818 |
| SHAPE-0264 | PinMessageForm | BaseModel | 1 | P17 | backend/open_webui/routers/channels.py:1382 |
| SHAPE-0265 | ReactionForm | BaseModel | 1 | P17 | backend/open_webui/routers/channels.py:1596 |
| SHAPE-0266 | WebhookMessageForm | BaseModel | 1 | P17 | backend/open_webui/routers/channels.py:2029 |
| SHAPE-0267 | ChatConfigForm | BaseModel | 11 | P06 | backend/open_webui/routers/chats.py:201 |
| SHAPE-0268 | CompactChatForm | BaseModel | 1 | P06 | backend/open_webui/routers/chats.py:215 |
| SHAPE-0269 | ChatStatsExportList | BaseModel | 4 | P06 | backend/open_webui/routers/chats.py:465 |
| SHAPE-0270 | TagForm | BaseModel | 1 | P06 | backend/open_webui/routers/chats.py:1325 |
| SHAPE-0271 | TagFilterForm | TagForm | 2 | P06 | backend/open_webui/routers/chats.py:1329 |
| SHAPE-0272 | MessageForm | BaseModel | 2 | P06 | backend/open_webui/routers/chats.py:1485 |
| SHAPE-0273 | EventForm | BaseModel | 2 | P06 | backend/open_webui/routers/chats.py:1599 |
| SHAPE-0274 | CloneForm | BaseModel | 1 | P06 | backend/open_webui/routers/chats.py:1755 |
| SHAPE-0275 | ForkForm | BaseModel | 1 | P06 | backend/open_webui/routers/chats.py:1759 |
| SHAPE-0276 | ChatAccessGrantsForm | BaseModel | 2 | P06 | backend/open_webui/routers/chats.py:2129 |
| SHAPE-0277 | ChatFolderIdForm | BaseModel | 1 | P06 | backend/open_webui/routers/chats.py:2210 |
| SHAPE-0278 | ImportConfigForm | BaseModel | 1 | P23 | backend/open_webui/routers/configs.py:96 |
| SHAPE-0279 | ConnectionsConfigForm | BaseModel | 3 | P23 | backend/open_webui/routers/configs.py:135 |
| SHAPE-0280 | OAuthClientRegistrationForm | BaseModel | 6 | P23 | backend/open_webui/routers/configs.py:165 |
| SHAPE-0281 | ToolServerConnection | BaseModel | 9 | P23 | backend/open_webui/routers/configs.py:222 |
| SHAPE-0282 | ToolServersConfigForm | BaseModel | 1 | P23 | backend/open_webui/routers/configs.py:236 |
| SHAPE-0283 | TerminalServerConnection | BaseModel | 11 | P23 | backend/open_webui/routers/configs.py:306 |
| SHAPE-0284 | TerminalServersConfigForm | BaseModel | 1 | P23 | backend/open_webui/routers/configs.py:327 |
| SHAPE-0285 | TerminalServerPolicyForm | BaseModel | 5 | P23 | backend/open_webui/routers/configs.py:412 |
| SHAPE-0286 | TerminalServerLifecycleForm | BaseModel | 5 | P23 | backend/open_webui/routers/configs.py:420 |
| SHAPE-0287 | TerminalServerRefreshForm | BaseModel | 7 | P23 | backend/open_webui/routers/configs.py:428 |
| SHAPE-0288 | CodeInterpreterConfigForm | BaseModel | 15 | P23 | backend/open_webui/routers/configs.py:706 |
| SHAPE-0289 | ModelsConfigForm | BaseModel | 5 | P23 | backend/open_webui/routers/configs.py:754 |
| SHAPE-0290 | SubagentsConfigForm | BaseModel | 7 | P23 | backend/open_webui/routers/configs.py:793 |
| SHAPE-0291 | PromptSuggestion | BaseModel | 2 | P23 | backend/open_webui/routers/configs.py:827 |
| SHAPE-0292 | SetDefaultSuggestionsForm | BaseModel | 2 | P23 | backend/open_webui/routers/configs.py:832 |
| SHAPE-0293 | SetBannersForm | BaseModel | 1 | P23 | backend/open_webui/routers/configs.py:868 |
| SHAPE-0294 | LeaderboardEntry | BaseModel | 6 | P22 | backend/open_webui/routers/evaluations.py:209 |
| SHAPE-0295 | LeaderboardResponse | BaseModel | 1 | P22 | backend/open_webui/routers/evaluations.py:218 |
| SHAPE-0296 | UpdateConfigForm | BaseModel | 2 | P22 | backend/open_webui/routers/evaluations.py:295 |
| SHAPE-0297 | ContentForm | BaseModel | 1 | P09 | backend/open_webui/routers/files.py:714 |
| SHAPE-0298 | FileRenameForm | BaseModel | 1 | P09 | backend/open_webui/routers/files.py:975 |
| SHAPE-0299 | FolderResponse | FolderModel | 2 | P06 | backend/open_webui/routers/folders.py:292 |
| SHAPE-0300 | FolderParentIdForm | BaseModel | 1 | P06 | backend/open_webui/routers/folders.py:421 |
| SHAPE-0301 | FolderIsExpandedForm | BaseModel | 1 | P06 | backend/open_webui/routers/folders.py:483 |
| SHAPE-0302 | FolderAccessGrantsForm | BaseModel | 2 | P06 | backend/open_webui/routers/folders.py:527 |
| SHAPE-0303 | LoadUrlForm | BaseModel | 1 | P12 | backend/open_webui/routers/functions.py:88 |
| SHAPE-0304 | SyncFunctionsForm | BaseModel | 1 | P12 | backend/open_webui/routers/functions.py:161 |
| SHAPE-0305 | FunctionVersionForm | BaseModel | 1 | P12 | backend/open_webui/routers/functions.py:731 |
| SHAPE-0306 | GroupExportResponse | GroupResponse | 1 | P03 | backend/open_webui/routers/groups.py:150 |
| SHAPE-0307 | GroupMemberInfo | UserInfoResponse | 2 | P03 | backend/open_webui/routers/groups.py:459 |
| SHAPE-0308 | GroupMembersResponse | BaseModel | 3 | P03 | backend/open_webui/routers/groups.py:464 |
| SHAPE-0309 | ImagesConfig | BaseModel | 33 | P16 | backend/open_webui/routers/images.py:229 |
| SHAPE-0310 | ConnectionVerificationForm | BaseModel | 3 | P16 | backend/open_webui/routers/images.py:333 |
| SHAPE-0311 | CreateImageForm | BaseModel | 6 | P16 | backend/open_webui/routers/images.py:446 |
| SHAPE-0312 | EditImageForm | BaseModel | 7 | P16 | backend/open_webui/routers/images.py:854 |
| SHAPE-0313 | KnowledgeAccessResponse | KnowledgeUserResponse | 1 | P13 | backend/open_webui/routers/knowledge.py:134 |
| SHAPE-0314 | KnowledgeAccessListResponse | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:138 |
| SHAPE-0315 | ExternalKnowledgeSourceForm | BaseModel | 3 | P13 | backend/open_webui/routers/knowledge.py:502 |
| SHAPE-0316 | ExternalKnowledgeCreateForm | BaseModel | 5 | P13 | backend/open_webui/routers/knowledge.py:508 |
| SHAPE-0317 | ExternalKnowledgeSourceCreateForm | BaseModel | 7 | P13 | backend/open_webui/routers/knowledge.py:516 |
| SHAPE-0318 | ExternalKnowledgeSourceUpdateForm | ExternalKnowledgeSourceCreateForm | 0 | P13 | backend/open_webui/routers/knowledge.py:526 |
| SHAPE-0319 | ExternalKnowledgeSourceTestForm | BaseModel | 5 | P13 | backend/open_webui/routers/knowledge.py:530 |
| SHAPE-0320 | ExternalKnowledgeRetrieveTestForm | BaseModel | 3 | P13 | backend/open_webui/routers/knowledge.py:538 |
| SHAPE-0321 | ExternalKnowledgeConnectionForm | BaseModel | 7 | P13 | backend/open_webui/routers/knowledge.py:544 |
| SHAPE-0322 | ExternalKnowledgeConnectionListResponse | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:554 |
| SHAPE-0323 | KnowledgeFilesResponse | KnowledgeResponse | 2 | P13 | backend/open_webui/routers/knowledge.py:1094 |
| SHAPE-0324 | KnowledgeAccessGrantsForm | BaseModel | 1 | P13 | backend/open_webui/routers/knowledge.py:1220 |
| SHAPE-0325 | KnowledgeFileIdForm | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:1420 |
| SHAPE-0326 | FileManifestEntry | BaseModel | 4 | P13 | backend/open_webui/routers/knowledge.py:1854 |
| SHAPE-0327 | SyncDiffForm | BaseModel | 1 | P13 | backend/open_webui/routers/knowledge.py:1861 |
| SHAPE-0328 | SyncDiffResponse | BaseModel | 7 | P13 | backend/open_webui/routers/knowledge.py:1865 |
| SHAPE-0329 | SyncCleanupForm | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:1990 |
| SHAPE-0330 | KnowledgeDirectoryCreateForm | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:2225 |
| SHAPE-0331 | KnowledgeDirectoryUpdateForm | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:2230 |
| SHAPE-0332 | KnowledgeFileMoveForm | BaseModel | 2 | P13 | backend/open_webui/routers/knowledge.py:2235 |
| SHAPE-0333 | AddMemoryForm | BaseModel | 3 | P14 | backend/open_webui/routers/memories.py:73 |
| SHAPE-0334 | MemoryUpdateModel | BaseModel | 3 | P14 | backend/open_webui/routers/memories.py:79 |
| SHAPE-0335 | MemoryOperationModel | BaseModel | 5 | P14 | backend/open_webui/routers/memories.py:85 |
| SHAPE-0336 | UpdateMemoriesForm | BaseModel | 2 | P14 | backend/open_webui/routers/memories.py:93 |
| SHAPE-0337 | SearchMemoriesForm | BaseModel | 5 | P14 | backend/open_webui/routers/memories.py:98 |
| SHAPE-0338 | ListMemoryPathsForm | BaseModel | 3 | P14 | backend/open_webui/routers/memories.py:106 |
| SHAPE-0339 | ReadMemoryPathForm | BaseModel | 4 | P14 | backend/open_webui/routers/memories.py:112 |
| SHAPE-0340 | QueryMemoryForm | BaseModel | 2 | P14 | backend/open_webui/routers/memories.py:327 |
| SHAPE-0341 | ModelExportResponse | ModelModel | 1 | P10 | backend/open_webui/routers/models.py:439 |
| SHAPE-0342 | ModelsImportForm | BaseModel | 1 | P10 | backend/open_webui/routers/models.py:499 |
| SHAPE-0343 | SyncModelsForm | BaseModel | 1 | P10 | backend/open_webui/routers/models.py:755 |
| SHAPE-0344 | ModelIdForm | BaseModel | 1 | P10 | backend/open_webui/routers/models.py:794 |
| SHAPE-0345 | ModelVersionForm | BaseModel | 1 | P10 | backend/open_webui/routers/models.py:952 |
| SHAPE-0346 | ModelAccessGrantsForm | BaseModel | 3 | P10 | backend/open_webui/routers/models.py:1251 |
| SHAPE-0347 | NoteItemResponse | BaseModel | 7 | P18 | backend/open_webui/routers/notes.py:87 |
| SHAPE-0348 | NoteResponse | NoteModel | 1 | P18 | backend/open_webui/routers/notes.py:259 |
| SHAPE-0349 | NoteAccessGrantsForm | BaseModel | 1 | P18 | backend/open_webui/routers/notes.py:586 |
| SHAPE-0350 | NotificationTargetForm | BaseModel | 6 | P23 | backend/open_webui/routers/notifications.py:25 |
| SHAPE-0351 | ConnectionVerificationForm | BaseModel | 3 | P04 | backend/open_webui/routers/ollama.py:234 |
| SHAPE-0352 | OllamaConfigForm | BaseModel | 3 | P04 | backend/open_webui/routers/ollama.py:286 |
| SHAPE-0353 | ModelNameForm | BaseModel | 1 | P04 | backend/open_webui/routers/ollama.py:599 |
| SHAPE-0354 | PushModelForm | BaseModel | 3 | P04 | backend/open_webui/routers/ollama.py:697 |
| SHAPE-0355 | CreateModelForm | BaseModel | 3 | P04 | backend/open_webui/routers/ollama.py:739 |
| SHAPE-0356 | CopyModelForm | BaseModel | 2 | P04 | backend/open_webui/routers/ollama.py:774 |
| SHAPE-0357 | GenerateEmbedForm | BaseModel | 5 | P04 | backend/open_webui/routers/ollama.py:899 |
| SHAPE-0358 | GenerateEmbeddingsForm | BaseModel | 4 | P04 | backend/open_webui/routers/ollama.py:954 |
| SHAPE-0359 | GenerateCompletionForm | BaseModel | 12 | P04 | backend/open_webui/routers/ollama.py:1007 |
| SHAPE-0360 | ChatMessage | BaseModel | 4 | P04 | backend/open_webui/routers/ollama.py:1066 |
| SHAPE-0361 | GenerateChatCompletionForm | BaseModel | 8 | P04 | backend/open_webui/routers/ollama.py:1083 |
| SHAPE-0362 | OpenAIChatMessageContent | BaseModel | 1 | P04 | backend/open_webui/routers/ollama.py:1206 |
| SHAPE-0363 | OpenAIChatMessage | BaseModel | 2 | P04 | backend/open_webui/routers/ollama.py:1213 |
| SHAPE-0364 | OpenAIChatCompletionForm | BaseModel | 2 | P04 | backend/open_webui/routers/ollama.py:1221 |
| SHAPE-0365 | OpenAICompletionForm | BaseModel | 2 | P04 | backend/open_webui/routers/ollama.py:1229 |
| SHAPE-0366 | OpenAIEmbeddingsForm | BaseModel | 2 | P04 | backend/open_webui/routers/ollama.py:1237 |
| SHAPE-0367 | ResponsesForm | BaseModel | 1 | P04 | backend/open_webui/routers/ollama.py:1460 |
| SHAPE-0368 | UrlForm | BaseModel | 1 | P04 | backend/open_webui/routers/ollama.py:1567 |
| SHAPE-0369 | UploadBlobForm | BaseModel | 1 | P04 | backend/open_webui/routers/ollama.py:1573 |
| SHAPE-0370 | OpenAIConfigForm | BaseModel | 4 | P04 | backend/open_webui/routers/openai.py:466 |
| SHAPE-0371 | ProviderModelOperationForm | BaseModel | 1 | P04 | backend/open_webui/routers/openai.py:863 |
| SHAPE-0372 | ConnectionVerificationForm | BaseModel | 3 | P04 | backend/open_webui/routers/openai.py:978 |
| SHAPE-0373 | ResponsesForm | BaseModel | 15 | P04 | backend/open_webui/routers/openai.py:1787 |
| SHAPE-0374 | AddPipelineForm | BaseModel | 2 | P12 | backend/open_webui/routers/pipelines.py:311 |
| SHAPE-0375 | DeletePipelineForm | BaseModel | 2 | P12 | backend/open_webui/routers/pipelines.py:361 |
| SHAPE-0376 | PromptVersionUpdateForm | BaseModel | 1 | P11 | backend/open_webui/routers/prompts.py:32 |
| SHAPE-0377 | PromptMetadataForm | BaseModel | 3 | P11 | backend/open_webui/routers/prompts.py:36 |
| SHAPE-0378 | PromptAccessGrantsForm | BaseModel | 1 | P11 | backend/open_webui/routers/prompts.py:437 |
| SHAPE-0379 | CollectionNameForm | BaseModel | 1 | P13 | backend/open_webui/routers/retrieval.py:419 |
| SHAPE-0380 | ProcessUrlForm | CollectionNameForm | 1 | P13 | backend/open_webui/routers/retrieval.py:423 |
| SHAPE-0381 | ProcessUrlResponse | BaseModel | 7 | P13 | backend/open_webui/routers/retrieval.py:427 |
| SHAPE-0382 | SearchForm | BaseModel | 1 | P13 | backend/open_webui/routers/retrieval.py:437 |
| SHAPE-0383 | OpenAIConfigForm | BaseModel | 2 | P13 | backend/open_webui/routers/retrieval.py:467 |
| SHAPE-0384 | OllamaConfigForm | BaseModel | 2 | P13 | backend/open_webui/routers/retrieval.py:472 |
| SHAPE-0385 | AzureOpenAIConfigForm | BaseModel | 3 | P13 | backend/open_webui/routers/retrieval.py:477 |
| SHAPE-0386 | EmbeddingModelUpdateForm | BaseModel | 8 | P13 | backend/open_webui/routers/retrieval.py:483 |
| SHAPE-0387 | WebConfig | BaseModel | 79 | P13 | backend/open_webui/routers/retrieval.py:765 |
| SHAPE-0388 | ConfigForm | BaseModel | 66 | P13 | backend/open_webui/routers/retrieval.py:847 |
| SHAPE-0389 | ProcessFileForm | BaseModel | 3 | P13 | backend/open_webui/routers/retrieval.py:1561 |
| SHAPE-0390 | ProcessTextForm | BaseModel | 3 | P13 | backend/open_webui/routers/retrieval.py:1840 |
| SHAPE-0391 | QueryDocForm | BaseModel | 7 | P13 | backend/open_webui/routers/retrieval.py:2738 |
| SHAPE-0392 | QueryCollectionsForm | BaseModel | 8 | P13 | backend/open_webui/routers/retrieval.py:2803 |
| SHAPE-0393 | DeleteForm | BaseModel | 2 | P13 | backend/open_webui/routers/retrieval.py:2879 |
| SHAPE-0394 | BatchProcessFilesForm | BaseModel | 2 | P13 | backend/open_webui/routers/retrieval.py:3000 |
| SHAPE-0395 | BatchProcessFilesResult | BaseModel | 3 | P13 | backend/open_webui/routers/retrieval.py:3005 |
| SHAPE-0396 | BatchProcessFilesResponse | BaseModel | 2 | P13 | backend/open_webui/routers/retrieval.py:3011 |
| SHAPE-0397 | SCIMError | BaseModel | 4 | P03 | backend/open_webui/routers/scim.py:83 |
| SHAPE-0398 | SCIMMeta | BaseModel | 5 | P03 | backend/open_webui/routers/scim.py:92 |
| SHAPE-0399 | SCIMName | BaseModel | 6 | P03 | backend/open_webui/routers/scim.py:102 |
| SHAPE-0400 | SCIMEmail | BaseModel | 4 | P03 | backend/open_webui/routers/scim.py:113 |
| SHAPE-0401 | SCIMPhoto | BaseModel | 4 | P03 | backend/open_webui/routers/scim.py:122 |
| SHAPE-0402 | SCIMGroupMember | BaseModel | 4 | P03 | backend/open_webui/routers/scim.py:131 |
| SHAPE-0403 | SCIMUser | BaseModel | 11 | P03 | backend/open_webui/routers/scim.py:142 |
| SHAPE-0404 | SCIMUserCreateRequest | BaseModel | 9 | P03 | backend/open_webui/routers/scim.py:160 |
| SHAPE-0405 | SCIMUserUpdateRequest | BaseModel | 9 | P03 | backend/open_webui/routers/scim.py:176 |
| SHAPE-0406 | SCIMGroup | BaseModel | 5 | P03 | backend/open_webui/routers/scim.py:192 |
| SHAPE-0407 | SCIMGroupCreateRequest | BaseModel | 3 | P03 | backend/open_webui/routers/scim.py:204 |
| SHAPE-0408 | SCIMGroupUpdateRequest | BaseModel | 3 | P03 | backend/open_webui/routers/scim.py:214 |
| SHAPE-0409 | SCIMListResponse | BaseModel | 5 | P03 | backend/open_webui/routers/scim.py:224 |
| SHAPE-0410 | SCIMPatchOperation | BaseModel | 3 | P03 | backend/open_webui/routers/scim.py:234 |
| SHAPE-0411 | SCIMPatchRequest | BaseModel | 2 | P03 | backend/open_webui/routers/scim.py:242 |
| SHAPE-0412 | SkillAccessGrantsForm | BaseModel | 1 | P11 | backend/open_webui/routers/skills.py:421 |
| SHAPE-0413 | SkillVersionUpdateForm | BaseModel | 2 | P11 | backend/open_webui/routers/skills.py:708 |
| SHAPE-0414 | CloneSkillForm | BaseModel | 3 | P11 | backend/open_webui/routers/skills.py:729 |
| SHAPE-0415 | LoadUrlForm | BaseModel | 1 | P11 | backend/open_webui/routers/skills.py:798 |
| SHAPE-0416 | TaskConfigForm | BaseModel | 19 | P05 | backend/open_webui/routers/tasks.py:114 |
| SHAPE-0417 | LoadUrlForm | BaseModel | 1 | P12 | backend/open_webui/routers/tools.py:282 |
| SHAPE-0418 | ToolAccessGrantsForm | BaseModel | 1 | P12 | backend/open_webui/routers/tools.py:631 |
| SHAPE-0419 | ToolVersionForm | BaseModel | 1 | P12 | backend/open_webui/routers/tools.py:1102 |
| SHAPE-0420 | WorkspacePermissions | BaseModel | 13 | P02 | backend/open_webui/routers/users.py:195 |
| SHAPE-0421 | SharingPermissions | BaseModel | 16 | P02 | backend/open_webui/routers/users.py:211 |
| SHAPE-0422 | AccessGrantsPermissions | BaseModel | 2 | P02 | backend/open_webui/routers/users.py:230 |
| SHAPE-0423 | ChatPermissions | BaseModel | 21 | P02 | backend/open_webui/routers/users.py:235 |
| SHAPE-0424 | FeaturesPermissions | BaseModel | 12 | P02 | backend/open_webui/routers/users.py:261 |
| SHAPE-0425 | SettingsPermissions | BaseModel | 1 | P02 | backend/open_webui/routers/users.py:277 |
| SHAPE-0426 | UserPermissions | BaseModel | 6 | P02 | backend/open_webui/routers/users.py:281 |
| SHAPE-0427 | UserUsageTotals | BaseModel | 13 | P02 | backend/open_webui/routers/users.py:290 |
| SHAPE-0428 | UserUsageHeatmapEntry | BaseModel | 5 | P02 | backend/open_webui/routers/users.py:306 |
| SHAPE-0429 | UserUsageModelEntry | BaseModel | 5 | P02 | backend/open_webui/routers/users.py:314 |
| SHAPE-0430 | UserUsageToolEntry | BaseModel | 2 | P02 | backend/open_webui/routers/users.py:322 |
| SHAPE-0431 | UserUsageInsights | BaseModel | 5 | P02 | backend/open_webui/routers/users.py:327 |
| SHAPE-0432 | UserUsagePeriod | BaseModel | 3 | P02 | backend/open_webui/routers/users.py:335 |
| SHAPE-0433 | UserUsageResponse | BaseModel | 8 | P02 | backend/open_webui/routers/users.py:341 |
| SHAPE-0434 | UserVariablesForm | BaseModel | 1 | P02 | backend/open_webui/routers/users.py:630 |
| SHAPE-0435 | UserVariablesResponse | BaseModel | 1 | P02 | backend/open_webui/routers/users.py:634 |
| SHAPE-0436 | CodeForm | BaseModel | 1 | P24 | backend/open_webui/routers/utils.py:26 |
| SHAPE-0437 | TaskItem | BaseModel | 3 | P12 | backend/open_webui/tools/builtin.py:3784 |
| SHAPE-0438 | ResultModel | BaseModel | 3 | P21 | backend/open_webui/utils/code_interpreter.py:15 |
| SHAPE-0439 | ComfyUINodeInput | BaseModel | 4 | P16 | backend/open_webui/utils/images/comfyui.py:123 |
| SHAPE-0440 | ComfyUIWorkflow | BaseModel | 2 | P16 | backend/open_webui/utils/images/comfyui.py:130 |
| SHAPE-0441 | ComfyUICreateImageForm | BaseModel | 8 | P16 | backend/open_webui/utils/images/comfyui.py:135 |
| SHAPE-0442 | ComfyUIEditImageForm | BaseModel | 8 | P16 | backend/open_webui/utils/images/comfyui.py:218 |
| SHAPE-0443 | MfaConfigForm | BaseModel | 3 | P00 | backend/open_webui/utils/mfa.py:39 |
| SHAPE-0444 | SkillFile | BaseModel | 3 | P11 | backend/open_webui/utils/skill_files.py:59 |
| SHAPE-0445 | SkillFileOperation | BaseModel | 5 | P11 | backend/open_webui/utils/skill_files.py:66 |
| SHAPE-0446 | ResolveToolCallForm | BaseModel | 4 | P12 | backend/open_webui/utils/tool_approval.py:16 |
