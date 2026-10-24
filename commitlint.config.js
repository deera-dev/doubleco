/**
 * Enforces Conventional Commits (semantic commit messages), e.g.:
 *   feat(auth): add magic-link sign-in
 *   fix(cart): prevent negative quantity
 * See README.md "Semantic Commit Messages" for the full type list.
 */
export default {
  extends: ['@commitlint/config-conventional'],
}
