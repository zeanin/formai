# FormAI ACL & Security Guidelines for Skills

FormAI operates on a Security-First model. By default, write actions (Create, Update, Delete) are disabled for runtime skills unless explicit role-based access control (ACL) permissions are granted.

## Roles Mapping

- **root / admin**: Full read and write permissions to all platform core features and dynamic collections.
- **developer**: Full access to compilers (`a2_compile_data_model`, `a2_compile_ui_schema`, etc.) and system configurations.
- **member / user**: Scope-restricted access to CRUD skills of specific business collections.

## Safeguards in Skills

- Run pre-execution checks inside executor/handlers to verify `roles` inside `SkillContext`.
- If a skill performs a dangerous operation (e.g. `delete` or bulk data modification), ensure `requiresConfirm` is set to `true` in its registration.
