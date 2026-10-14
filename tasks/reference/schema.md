# Baseline inventory Open WebUI

Commit `f8ae8a6c328946dc62cd0712961a0632574581bf`. Metadata hasil scan, bukan source code aplikasi. Seluruh row masuk target planning; status perilaku belum diverifikasi.


## ORM schema declarations

Tidak mengganti migrasi/live introspection: nullable implicit mengikuti ORM, default yang berupa operasi/simbol belum dievaluasi. `JSONField` berbeda dari native JSON. Constraint yang terakhir dideklarasikan adalah efektif; shadowed declarations tidak dipakai.

## DB-001 — access_grant (AccessGrant)

Owner P03; `backend/open_webui/models/access_grants.py:25`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| resource_type | Text | False | {"nullable":false} | [] |
| resource_id | Text | False | {"nullable":false} | [] |
| principal_type | Text | False | {"nullable":false} | [] |
| principal_id | Text | False | {"nullable":false} | [] |
| permission | Text | False | {"nullable":false} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"UniqueConstraint","arguments":["resource_type","resource_id","principal_type","principal_id","permission"],"options":{"name":"uq_access_grant_grant"}}]
Shadowed table-args declarations: 0.

## DB-002 — auth (Auth)

Owner P02; `backend/open_webui/models/auths.py:27`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| email | String | True | {} | [] |
| password | Text | True | {} | [] |
| active | Boolean | True | {} | [] |
| mfa | JSON | True | {"nullable":true} | [] |
| session_stamp | Text | True | {"nullable":true} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-003 — automation (Automation)

Owner P20; `backend/open_webui/models/automations.py:20`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| folder_id | Text | True | {"nullable":true} | [] |
| name | Text | False | {"nullable":false} | [] |
| data | JSON | False | {"nullable":false} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| is_active | Boolean | False | {"nullable":false,"default":true} | [] |
| last_run_at | BigInteger | True | {"nullable":true} | [] |
| next_run_at | BigInteger | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"Index","arguments":["ix_automation_next_run","next_run_at"],"options":{}},{"operation":"Index","arguments":["ix_automation_user_folder","user_id","folder_id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-004 — automation_run (AutomationRun)

Owner P20; `backend/open_webui/models/automations.py:42`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| automation_id | Text | False | {"nullable":false} | [] |
| chat_id | Text | True | {"nullable":true} | [] |
| status | Text | False | {"nullable":false} | [] |
| error | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"Index","arguments":["ix_automation_run_automation_id","automation_id"],"options":{}},{"operation":"Index","arguments":["ix_automation_run_aid_created","automation_id","created_at"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-005 — calendar (Calendar)

Owner P19; `backend/open_webui/models/calendar.py:38`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| name | Text | False | {"nullable":false} | [] |
| color | Text | True | {"nullable":true} | [] |
| is_default | Boolean | False | {"nullable":false,"default":false} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"Index","arguments":["ix_calendar_user","user_id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-006 — calendar_event (CalendarEvent)

Owner P19; `backend/open_webui/models/calendar.py:55`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| calendar_id | Text | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| title | Text | False | {"nullable":false} | [] |
| description | Text | True | {"nullable":true} | [] |
| start_at | BigInteger | False | {"nullable":false} | [] |
| end_at | BigInteger | True | {"nullable":true} | [] |
| all_day | Boolean | False | {"nullable":false,"default":false} | [] |
| rrule | Text | True | {"nullable":true} | [] |
| color | Text | True | {"nullable":true} | [] |
| location | Text | True | {"nullable":true} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| is_cancelled | Boolean | False | {"nullable":false,"default":false} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"Index","arguments":["ix_calendar_event_calendar","calendar_id","start_at"],"options":{}},{"operation":"Index","arguments":["ix_calendar_event_user_date","user_id","start_at"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-007 — calendar_event_attendee (CalendarEventAttendee)

Owner P19; `backend/open_webui/models/calendar.py:82`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| event_id | Text | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| status | Text | False | {"nullable":false,"default":"pending"} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"UniqueConstraint","arguments":["event_id","user_id"],"options":{"name":"uq_event_attendee"}},{"operation":"Index","arguments":["ix_calendar_event_attendee_user","user_id","status"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-008 — channel (Channel)

Owner P17; `backend/open_webui/models/channels.py:40`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | True | {} | [] |
| type | Text | True | {"nullable":true} | [] |
| name | Text | True | {} | [] |
| description | Text | True | {"nullable":true} | [] |
| is_private | Boolean | True | {"nullable":true} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |
| updated_by | Text | True | {"nullable":true} | [] |
| archived_at | BigInteger | True | {"nullable":true} | [] |
| archived_by | Text | True | {"nullable":true} | [] |
| deleted_at | BigInteger | True | {"nullable":true} | [] |
| deleted_by | Text | True | {"nullable":true} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-009 — channel_member (ChannelMember)

Owner P17; `backend/open_webui/models/channels.py:97`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| channel_id | Text | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| role | Text | True | {"nullable":true} | [] |
| status | Text | True | {"nullable":true} | [] |
| is_active | Boolean | False | {"nullable":false,"default":true} | [] |
| is_channel_muted | Boolean | False | {"nullable":false,"default":false} | [] |
| is_channel_pinned | Boolean | False | {"nullable":false,"default":false} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| invited_at | BigInteger | True | {"nullable":true} | [] |
| invited_by | Text | True | {"nullable":true} | [] |
| joined_at | BigInteger | True | {} | [] |
| left_at | BigInteger | True | {"nullable":true} | [] |
| last_read_at | BigInteger | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-010 — channel_file (ChannelFile)

Owner P17; `backend/open_webui/models/channels.py:157`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| channel_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["channel.id"],"options":{"ondelete":"CASCADE"}}] |
| message_id | Text | True | {"nullable":true} | [{"operation":"ForeignKey","arguments":["message.id"],"options":{"ondelete":"CASCADE"}}] |
| file_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["file.id"],"options":{"ondelete":"CASCADE"}}] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"UniqueConstraint","arguments":["channel_id","file_id"],"options":{"name":"uq_channel_file_channel_file"}}]
Shadowed table-args declarations: 0.

## DB-011 — channel_webhook (ChannelWebhook)

Owner P17; `backend/open_webui/models/channels.py:186`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| channel_id | Text | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| name | Text | False | {"nullable":false} | [] |
| profile_image_url | Text | True | {"nullable":true} | [] |
| token | Text | False | {"nullable":false} | [] |
| last_used_at | BigInteger | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-012 — chat_message (ChatMessage)

Owner P05; `backend/open_webui/models/chat_messages.py:130`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| chat_id | Text | False | {"nullable":false,"index":true} | [{"operation":"ForeignKey","arguments":["chat.id"],"options":{"ondelete":"CASCADE"}}] |
| user_id | Text | True | {"index":true} | [] |
| role | Text | False | {"nullable":false} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| content | JSON | True | {"nullable":true} | [] |
| output | JSON | True | {"nullable":true} | [] |
| model_id | Text | True | {"nullable":true,"index":true} | [] |
| files | JSON | True | {"nullable":true} | [] |
| sources | JSON | True | {"nullable":true} | [] |
| embeds | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| done | Boolean | True | {"default":true} | [] |
| status_history | JSON | True | {"nullable":true} | [] |
| error | JSON | True | {"nullable":true} | [] |
| usage | JSON | True | {"nullable":true} | [] |
| context_summary | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {"index":true} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: [{"operation":"Index","arguments":["chat_message_chat_parent_idx","chat_id","parent_id"],"options":{}},{"operation":"Index","arguments":["chat_message_model_created_idx","model_id","created_at"],"options":{}},{"operation":"Index","arguments":["chat_message_user_created_idx","user_id","created_at"],"options":{}},{"operation":"Index","arguments":["chat_message_chat_role_done_idx","chat_id","role","done"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-013 — chat (Chat)

Owner P06; `backend/open_webui/models/chats.py:131`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| user_id | String | True | {"index":true} | [] |
| title | Text | True | {} | [] |
| chat | JSON | True | {} | [] |
| created_at | BigInteger | True | {"index":true} | [] |
| updated_at | BigInteger | True | {"index":true} | [] |
| share_id | Text | True | {"unique":true,"nullable":true} | [] |
| archived | Boolean | True | {"default":false} | [] |
| pinned | Boolean | True | {"default":false,"nullable":true} | [] |
| meta | JSON | True | {"server_default":"{}"} | [] |
| variables | JSON | True | {"nullable":true} | [] |
| folder_id | Text | True | {"nullable":true} | [] |
| tasks | JSON | True | {"nullable":true} | [] |
| summary | Text | True | {"nullable":true} | [] |
| current_message_id | Text | True | {"nullable":true} | [] |
| last_read_at | BigInteger | True | {"nullable":true} | [] |
| timer_at | BigInteger | True | {"nullable":true} | [] |

Table constraints: [{"operation":"Index","arguments":["folder_id_idx","folder_id"],"options":{}},{"operation":"Index","arguments":["user_id_pinned_idx","user_id","pinned"],"options":{}},{"operation":"Index","arguments":["user_id_archived_idx","user_id","archived"],"options":{}},{"operation":"Index","arguments":["updated_at_user_id_idx","updated_at","user_id"],"options":{}},{"operation":"Index","arguments":["folder_id_user_id_idx","folder_id","user_id"],"options":{}},{"operation":"Index","arguments":["user_id_updated_at_id_idx","user_id",{"operation":"updated_at.desc","arguments":[],"options":{}},"id"],"options":{}},{"operation":"Index","arguments":["timer_at_idx","timer_at"],"options":{"sqlite_where":{"operation":"text","arguments":["timer_at IS NOT NULL"],"options":{}},"postgresql_where":{"operation":"text","arguments":["timer_at IS NOT NULL"],"options":{}}}},{"operation":"Index","arguments":["user_id_timer_at_idx","user_id","timer_at"],"options":{"sqlite_where":{"operation":"text","arguments":["timer_at IS NOT NULL"],"options":{}},"postgresql_where":{"operation":"text","arguments":["timer_at IS NOT NULL"],"options":{}}}},{"operation":"Index","arguments":["user_id_folder_unread_idx","user_id","folder_id","archived","updated_at","last_read_at","id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-014 — chat_file (ChatFile)

Owner P06; `backend/open_webui/models/chats.py:219`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| chat_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["chat.id"],"options":{"ondelete":"CASCADE"}}] |
| message_id | Text | True | {"nullable":true} | [] |
| file_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["file.id"],"options":{"ondelete":"CASCADE"}}] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"UniqueConstraint","arguments":["chat_id","file_id"],"options":{"name":"uq_chat_file_chat_file"}}]
Shadowed table-args declarations: 0.

## DB-015 — config (Config)

Owner P23; `backend/open_webui/models/config.py:102`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| key | Text | False | {"primary_key":true} | [] |
| value | JSON | False | {"nullable":false} | [] |
| updated_at | BigInteger | True | {"nullable":true} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-016 — feedback (Feedback)

Owner P22; `backend/open_webui/models/feedbacks.py:20`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | True | {} | [] |
| version | BigInteger | True | {"default":0} | [] |
| type | Text | True | {} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| snapshot | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-017 — file (File)

Owner P09; `backend/open_webui/models/files.py:18`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| user_id | String | True | {"index":true} | [] |
| hash | Text | True | {"nullable":true} | [] |
| filename | Text | True | {} | [] |
| path | Text | True | {"nullable":true} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {"index":true} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-018 — folder (Folder)

Owner P06; `backend/open_webui/models/folders.py:22`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| user_id | Text | True | {} | [] |
| name | Text | True | {} | [] |
| items | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| data | JSON | True | {"nullable":true} | [] |
| is_expanded | Boolean | True | {"default":false} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-019 — function_history (FunctionHistory)

Owner P12; `backend/open_webui/models/function_history.py:14`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| function_id | Text | False | {"nullable":false,"index":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| snapshot | JSON | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| commit_message | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-020 — function (Function)

Owner P12; `backend/open_webui/models/functions.py:21`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| version_id | Text | True | {"nullable":true} | [] |
| user_id | String | True | {"index":true} | [] |
| name | Text | False | {"nullable":false} | [] |
| type | Text | False | {"nullable":false} | [] |
| content | Text | True | {"nullable":true} | [] |
| meta | JSONField | True | {"nullable":true} | [] |
| valves | JSONField | True | {"nullable":true} | [] |
| is_active | Boolean | True | {"default":false} | [] |
| is_global | Boolean | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |
| created_at | BigInteger | True | {} | [] |

Table constraints: [{"operation":"Index","arguments":["is_global_idx","is_global"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-021 — group (Group)

Owner P03; `backend/open_webui/models/groups.py:40`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| parent_group_id | Text | True | {"nullable":true,"index":true} | [{"operation":"ForeignKey","arguments":["group.id"],"options":{"name":"fk_group_parent","ondelete":"SET NULL"}}] |
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| user_id | Text | True | {} | [] |
| name | Text | True | {} | [] |
| description | Text | True | {} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| permissions | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-022 — group_member (GroupMember)

Owner P03; `backend/open_webui/models/groups.py:81`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| group_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["group.id"],"options":{"ondelete":"CASCADE"}}] |
| user_id | Text | False | {"nullable":false} | [] |
| created_at | BigInteger | True | {"nullable":true} | [] |
| updated_at | BigInteger | True | {"nullable":true} | [] |

Table constraints: [{"operation":"Index","arguments":["ix_group_member_user_id_group_id","user_id","group_id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-023 — knowledge (Knowledge)

Owner P13; `backend/open_webui/models/knowledge.py:48`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| user_id | Text | True | {} | [] |
| name | Text | True | {} | [] |
| description | Text | True | {} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-024 — knowledge_directory (KnowledgeDirectory)

Owner P13; `backend/open_webui/models/knowledge.py:63`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| knowledge_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["knowledge.id"],"options":{"ondelete":"CASCADE"}}] |
| parent_id | Text | True | {"nullable":true} | [{"operation":"ForeignKey","arguments":["knowledge_directory.id"],"options":{"ondelete":"CASCADE"}}] |
| name | Text | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"UniqueConstraint","arguments":["knowledge_id","parent_id","name"],"options":{"name":"uq_knowledge_directory_knowledge_parent_name"}},{"operation":"Index","arguments":["ix_knowledge_directory_knowledge_id","knowledge_id"],"options":{}},{"operation":"Index","arguments":["ix_knowledge_directory_parent_id","parent_id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-025 — knowledge_file (KnowledgeFile)

Owner P13; `backend/open_webui/models/knowledge.py:99`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"unique":true,"primary_key":true} | [] |
| knowledge_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["knowledge.id"],"options":{"ondelete":"CASCADE"}}] |
| file_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["file.id"],"options":{"ondelete":"CASCADE"}}] |
| directory_id | Text | True | {"nullable":true} | [{"operation":"ForeignKey","arguments":["knowledge_directory.id"],"options":{"ondelete":"SET NULL"}}] |
| user_id | Text | False | {"nullable":false} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"UniqueConstraint","arguments":["knowledge_id","file_id"],"options":{"name":"uq_knowledge_file_knowledge_file"}},{"operation":"Index","arguments":["ix_knowledge_file_directory_id","directory_id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-026 — memory (Memory)

Owner P14; `backend/open_webui/models/memories.py:15`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| user_id | String | True | {"index":true} | [] |
| type | String | True | {"default":"context","server_default":"context","index":true} | [] |
| path | Text | True | {"nullable":true} | [] |
| content | Text | True | {} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| updated_at | BigInteger | True | {} | [] |
| created_at | BigInteger | True | {} | [] |

Table constraints: [{"operation":"Index","arguments":["ix_memory_id_user_id","id","user_id"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-027 — message_reaction (MessageReaction)

Owner P17; `backend/open_webui/models/messages.py:19`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | True | {} | [] |
| message_id | Text | True | {} | [] |
| name | Text | True | {} | [] |
| created_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-028 — message (Message)

Owner P17; `backend/open_webui/models/messages.py:38`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | True | {} | [] |
| channel_id | Text | True | {"nullable":true} | [] |
| reply_to_id | Text | True | {"nullable":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| is_pinned | Boolean | False | {"nullable":false,"default":false} | [] |
| pinned_at | BigInteger | True | {"nullable":true} | [] |
| pinned_by | Text | True | {"nullable":true} | [] |
| content | Text | True | {} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-029 — model_history (ModelHistory)

Owner P10; `backend/open_webui/models/model_history.py:28`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| model_id | Text | False | {"nullable":false,"index":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| snapshot | JSON | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| commit_message | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-030 — model (Model)

Owner P10; `backend/open_webui/models/models.py:182`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | True | {} | [] |
| base_model_id | Text | True | {"nullable":true} | [] |
| name | Text | True | {} | [] |
| params | JSONField | True | {} | [] |
| meta | JSONField | True | {} | [] |
| version_id | Text | True | {"nullable":true} | [] |
| is_active | Boolean | True | {"default":true} | [] |
| updated_at | BigInteger | True | {} | [] |
| created_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-031 — note (Note)

Owner P18; `backend/open_webui/models/notes.py:20`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | True | {} | [] |
| title | Text | True | {} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-032 — pinned_note (PinnedNote)

Owner P18; `backend/open_webui/models/notes.py:82`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| note_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["note.id"],"options":{"ondelete":"CASCADE"}}] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-033 — oauth_session (OAuthSession)

Owner P02; `backend/open_webui/models/oauth_sessions.py:23`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| provider | Text | False | {"nullable":false} | [] |
| token | Text | False | {"nullable":false} | [] |
| expires_at | BigInteger | False | {"nullable":false} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: [{"operation":"Index","arguments":["idx_oauth_session_user_id","user_id"],"options":{}},{"operation":"Index","arguments":["idx_oauth_session_expires_at","expires_at"],"options":{}},{"operation":"Index","arguments":["idx_oauth_session_user_provider","user_id","provider"],"options":{}}]
Shadowed table-args declarations: 0.

## DB-034 — prompt_history (PromptHistory)

Owner P11; `backend/open_webui/models/prompt_history.py:19`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| prompt_id | Text | False | {"nullable":false,"index":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| snapshot | JSON | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| commit_message | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-035 — prompt (Prompt)

Owner P11; `backend/open_webui/models/prompts.py:23`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| command | String | True | {"unique":true,"index":true} | [] |
| user_id | String | True | {"index":true} | [] |
| name | Text | True | {} | [] |
| content | Text | True | {} | [] |
| data | JSON | True | {"nullable":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |
| tags | JSON | True | {"nullable":true} | [] |
| is_active | Boolean | True | {"default":true} | [] |
| version_id | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | True | {"nullable":true} | [] |
| updated_at | BigInteger | True | {"nullable":true} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-036 — shared_chat (SharedChat)

Owner P06; `backend/open_webui/models/shared_chats.py:25`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| chat_id | Text | False | {"nullable":false} | [{"operation":"ForeignKey","arguments":["chat.id"],"options":{"ondelete":"CASCADE"}}] |
| user_id | Text | False | {"nullable":false} | [] |
| title | Text | True | {} | [] |
| chat | JSON | True | {} | [] |
| created_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-037 — skill_history (SkillHistory)

Owner P11; `backend/open_webui/models/skill_history.py:10`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| skill_id | Text | False | {"nullable":false,"index":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| snapshot | JSON | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| commit_message | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-038 — skill (Skill)

Owner P11; `backend/open_webui/models/skills.py:24`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| user_id | String | True | {} | [] |
| name | Text | True | {"unique":true} | [] |
| description | Text | True | {"nullable":true} | [] |
| content | Text | True | {} | [] |
| data | JSON | True | {"nullable":true} | [] |
| version_id | Text | True | {"nullable":true} | [] |
| meta | JSON | True | {} | [] |
| is_active | Boolean | True | {"default":true} | [] |
| updated_at | BigInteger | True | {} | [] |
| created_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-039 — tag (Tag)

Owner P06; `backend/open_webui/models/tags.py:18`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {} | [] |
| name | String | True | {"index":true} | [] |
| user_id | String | False | {"index":true} | [] |
| meta | JSON | True | {"nullable":true} | [] |

Table constraints: [{"operation":"PrimaryKeyConstraint","arguments":["id","user_id"],"options":{"name":"pk_id_user_id"}}]
Shadowed table-args declarations: 1.

## DB-040 — tool_history (ToolHistory)

Owner P12; `backend/open_webui/models/tool_history.py:14`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true} | [] |
| tool_id | Text | False | {"nullable":false,"index":true} | [] |
| parent_id | Text | True | {"nullable":true} | [] |
| snapshot | JSON | False | {"nullable":false} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| commit_message | Text | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-041 — tool (Tool)

Owner P12; `backend/open_webui/models/tools.py:23`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| version_id | Text | True | {"nullable":true} | [] |
| user_id | String | True | {"index":true} | [] |
| name | Text | True | {} | [] |
| content | Text | True | {} | [] |
| specs | JSONField | True | {} | [] |
| meta | JSONField | True | {} | [] |
| valves | JSONField | True | {} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |
| created_at | BigInteger | True | {"index":true} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-042 — user (User)

Owner P02; `backend/open_webui/models/users.py:142`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | String | False | {"primary_key":true,"unique":true} | [] |
| email | String | True | {"unique":true} | [] |
| username | {"operation":"String","arguments":[50],"options":{}} | True | {"nullable":true} | [] |
| role | String | True | {"default":"pending"} | [] |
| name | String | False | {"nullable":false} | [] |
| profile_image_url | Text | True | {} | [] |
| profile_banner_image_url | Text | True | {"nullable":true} | [] |
| bio | Text | True | {"nullable":true} | [] |
| gender | Text | True | {"nullable":true} | [] |
| date_of_birth | Date | True | {"nullable":true} | [] |
| timezone | String | True | {"nullable":true} | [] |
| presence_state | String | True | {"nullable":true} | [] |
| status_emoji | String | True | {"nullable":true} | [] |
| status_message | Text | True | {"nullable":true} | [] |
| status_expires_at | BigInteger | True | {"nullable":true} | [] |
| info | JSON | True | {"nullable":true} | [] |
| variables | JSON | True | {"nullable":true} | [] |
| settings | JSON | True | {"nullable":true} | [] |
| oauth | JSON | True | {"nullable":true} | [] |
| scim | JSON | True | {"nullable":true} | [] |
| last_active_at | BigInteger | True | {} | [] |
| updated_at | BigInteger | True | {} | [] |
| created_at | BigInteger | True | {} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## DB-043 — api_key (ApiKey)

Owner P02; `backend/open_webui/models/users.py:239`.

| Column | Type | Nullable | Options | Other arguments |
|---|---|---|---|---|
| id | Text | False | {"primary_key":true,"unique":true} | [] |
| user_id | Text | False | {"nullable":false} | [] |
| key | Text | False | {"unique":true,"nullable":false} | [] |
| data | JSON | True | {"nullable":true} | [] |
| expires_at | BigInteger | True | {"nullable":true} | [] |
| last_used_at | BigInteger | True | {"nullable":true} | [] |
| created_at | BigInteger | False | {"nullable":false} | [] |
| updated_at | BigInteger | False | {"nullable":false} | [] |

Table constraints: []
Shadowed table-args declarations: 0.

## Migration chain

| ID | Revision | Parent | Source |
|---|---|---|---|
| MIG-001 | "018012973d35" | "d31026856c01" | backend/open_webui/migrations/versions/018012973d35_add_indexes.py |
| MIG-002 | "1af9b942657b" | "242a2047eae0" | backend/open_webui/migrations/versions/1af9b942657b_migrate_tags.py |
| MIG-003 | "1ce6ade7d93b" | "f0bd01a18a3d" | backend/open_webui/migrations/versions/1ce6ade7d93b_add_group_member_user_id_index.py |
| MIG-004 | "242a2047eae0" | "6a39f3d8e55c" | backend/open_webui/migrations/versions/242a2047eae0_update_chat_table.py |
| MIG-005 | null | null | backend/open_webui/migrations/versions/2f1211949ecc_update_message_and_channel_member_table.py |
| MIG-006 | null | null | backend/open_webui/migrations/versions/374d2f66af06_add_prompt_history_table.py |
| MIG-007 | "3781e22d8b01" | "7826ab40b532" | backend/open_webui/migrations/versions/3781e22d8b01_update_message_table.py |
| MIG-008 | null | null | backend/open_webui/migrations/versions/37f288994c47_add_group_member_table.py |
| MIG-009 | null | null | backend/open_webui/migrations/versions/38d63c18f30f_add_oauth_session_table.py |
| MIG-010 | "3ab32c4b8f59" | "1af9b942657b" | backend/open_webui/migrations/versions/3ab32c4b8f59_update_tags.py |
| MIG-011 | null | null | backend/open_webui/migrations/versions/3af16a1c9fb6_update_user_table.py |
| MIG-012 | null | null | backend/open_webui/migrations/versions/3c9b0ca343fd_add_knowledge_directory_table.py |
| MIG-013 | null | null | backend/open_webui/migrations/versions/3e0e00844bb0_add_knowledge_file_table.py |
| MIG-014 | null | null | backend/open_webui/migrations/versions/3ff2c63645b8_reshape_config_to_per_key_rows.py |
| MIG-015 | null | null | backend/open_webui/migrations/versions/42e2978c7933_add_memory_path_and_meta.py |
| MIG-016 | null | null | backend/open_webui/migrations/versions/461111b60977_add_missing_primary_keys_to_legacy_.py |
| MIG-017 | "4ace53fd72c8" | "af906e964978" | backend/open_webui/migrations/versions/4ace53fd72c8_update_folder_table_datetime.py |
| MIG-018 | null | null | backend/open_webui/migrations/versions/4c5ce3d2f27f_add_context_summary_to_chat_message.py |
| MIG-019 | null | null | backend/open_webui/migrations/versions/4de81c2a3af1_add_pinned_note_table.py |
| MIG-020 | null | null | backend/open_webui/migrations/versions/55f1302ac17c_add_memory_id_user_id_covering_index.py |
| MIG-021 | null | null | backend/open_webui/migrations/versions/56359461a091_add_calendar_tables.py |
| MIG-022 | "57c599a3cb57" | "922e7a387820" | backend/open_webui/migrations/versions/57c599a3cb57_add_channel_table.py |
| MIG-023 | null | null | backend/open_webui/migrations/versions/6283dc0e4d8d_add_channel_file_table.py |
| MIG-024 | "6a39f3d8e55c" | "c0fbf31ca0db" | backend/open_webui/migrations/versions/6a39f3d8e55c_add_knowledge_table.py |
| MIG-025 | null | null | backend/open_webui/migrations/versions/6d09d1bf1f23_repair_double_encoded_user_oauth.py |
| MIG-026 | "7826ab40b532" | "57c599a3cb57" | backend/open_webui/migrations/versions/7826ab40b532_update_file_table.py |
| MIG-027 | null | null | backend/open_webui/migrations/versions/7b3f2a9c1d4e_add_memory_type.py |
| MIG-028 | null | null | backend/open_webui/migrations/versions/7e5b5dc7342b_init.py |
| MIG-029 | null | null | backend/open_webui/migrations/versions/81cc2ce44d79_update_channel_file_and_knowledge_table.py |
| MIG-030 | null | null | backend/open_webui/migrations/versions/8452d01d26d7_add_chat_message_table.py |
| MIG-031 | null | null | backend/open_webui/migrations/versions/856c5b02fb54_add_chat_message_meta.py |
| MIG-032 | null | null | backend/open_webui/migrations/versions/90ef40d4714e_update_channel_and_channel_members_table.py |
| MIG-033 | "922e7a387820" | "4ace53fd72c8" | backend/open_webui/migrations/versions/922e7a387820_add_group_table.py |
| MIG-034 | null | null | backend/open_webui/migrations/versions/959eaac8f909_add_automation_folder_id.py |
| MIG-035 | null | null | backend/open_webui/migrations/versions/9a1b2c3d4e5f_add_current_message_id_to_chat.py |
| MIG-036 | "9f0c9cd09105" | "3781e22d8b01" | backend/open_webui/migrations/versions/9f0c9cd09105_add_note_table.py |
| MIG-037 | "a0b1c2d3e4f5" | "4de81c2a3af1" | backend/open_webui/migrations/versions/a0b1c2d3e4f5_add_memory_user_id_index.py |
| MIG-038 | null | null | backend/open_webui/migrations/versions/a1b2c3d4e5f6_add_skill_table.py |
| MIG-039 | null | null | backend/open_webui/migrations/versions/a3dd5bedd151_add_tasks_and_summary_to_chat.py |
| MIG-040 | null | null | backend/open_webui/migrations/versions/a5c220713937_add_reply_to_id_column_to_message.py |
| MIG-041 | "a7d3e9f2b641" | "d4c1a8e37b62" | backend/open_webui/migrations/versions/a7d3e9f2b641_add_mfa_and_session_stamp.py |
| MIG-042 | "af906e964978" | "c29facfe716b" | backend/open_webui/migrations/versions/af906e964978_add_feedback_table.py |
| MIG-043 | null | null | backend/open_webui/migrations/versions/b0018471bbbe_add_user_variables.py |
| MIG-044 | null | null | backend/open_webui/migrations/versions/b10670c03dd5_update_user_table.py |
| MIG-045 | null | null | backend/open_webui/migrations/versions/b2c3d4e5f6a7_add_scim_column_to_user_table.py |
| MIG-046 | "b7c8d9e0f1a2" | "d4e5f6a7b8c9" | backend/open_webui/migrations/versions/b7c8d9e0f1a2_add_last_read_at_to_chat.py |
| MIG-047 | "b8e4f0a3c752" | "a7d3e9f2b641" | backend/open_webui/migrations/versions/b8e4f0a3c752_add_group_hierarchy.py |
| MIG-048 | "b8f2c6d91a04" | "f8c0e5b134cd" | backend/open_webui/migrations/versions/b8f2c6d91a04_add_postgres_pending_files_index.py |
| MIG-049 | null | null | backend/open_webui/migrations/versions/c0fbf31ca0db_update_file_table.py |
| MIG-050 | "c1d2e3f4a5b6" | "e1f2a3b4c5d6" | backend/open_webui/migrations/versions/c1d2e3f4a5b6_add_shared_chat_table.py |
| MIG-051 | "c29facfe716b" | "c69f45358db4" | backend/open_webui/migrations/versions/c29facfe716b_update_file_table_path.py |
| MIG-052 | null | null | backend/open_webui/migrations/versions/c440947495f3_add_chat_file_table.py |
| MIG-053 | null | null | backend/open_webui/migrations/versions/c49178636c78_add_chat_variables.py |
| MIG-054 | "c69f45358db4" | "3ab32c4b8f59" | backend/open_webui/migrations/versions/c69f45358db4_add_folder_table.py |
| MIG-055 | null | null | backend/open_webui/migrations/versions/ca81bd47c050_add_config_table.py |
| MIG-056 | "d31026856c01" | "9f0c9cd09105" | backend/open_webui/migrations/versions/d31026856c01_update_folder_table_data.py |
| MIG-057 | null | null | backend/open_webui/migrations/versions/d4c1a8e37b62_add_chat_timer_at_and_chat_indexes.py |
| MIG-058 | null | null | backend/open_webui/migrations/versions/d4e5f6a7b8c9_add_automation_tables.py |
| MIG-059 | "d6a8c3f912ab" | "b8e4f0a3c752" | backend/open_webui/migrations/versions/d6a8c3f912ab_add_skill_history.py |
| MIG-060 | "e1f2a3b4c5d6" | "b7c8d9e0f1a2" | backend/open_webui/migrations/versions/e1f2a3b4c5d6_add_is_pinned_to_note.py |
| MIG-061 | "e7b9d4a023bc" | "d6a8c3f912ab" | backend/open_webui/migrations/versions/e7b9d4a023bc_add_model_history.py |
| MIG-062 | null | null | backend/open_webui/migrations/versions/f0bd01a18a3d_add_unique_normalized_user_email_index.py |
| MIG-063 | null | null | backend/open_webui/migrations/versions/f1e2d3c4b5a6_add_access_grant_table.py |
| MIG-064 | "f8c0e5b134cd" | "e7b9d4a023bc" | backend/open_webui/migrations/versions/f8c0e5b134cd_add_tool_history_and_function_history.py |
