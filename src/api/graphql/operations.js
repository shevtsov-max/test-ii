/**
 * Операции GraphQL. Схема сервера описана в docs/api/schema.graphql —
 * типы повторяют модель древа (src/domain/types.js), поэтому ответы не нужно преобразовывать.
 */
import { gql } from './client'

const DATE = gql`
  qualifier
  day
  month
  year
  day2
  month2
  year2
  calendar
  text
`

const CITATION = gql`
  id
  sourceId
  page
  quality
  note
`

const POINT = gql`
  date { ${DATE} }
  placeId
  citations { ${CITATION} }
`

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    email
    name
    avatar
    emailVerified
    createdAt
  }
`

const AUTH_PAYLOAD = gql`
  accessToken
  refreshToken
  user { ...UserFields }
`

export const TREE_SUMMARY_FIELDS = gql`
  fragment TreeSummaryFields on TreeSummary {
    id
    name
    description
    persons
    families
    media
    homeName
    homeThumb
    homeGender
    role
    createdAt
    updatedAt
  }
`

export const TREE_FIELDS = gql`
  fragment TreeFields on Tree {
    id
    name
    description
    homePersonId
    version
    role
    createdAt
    updatedAt
    customFields { id label type }
    persons {
      id gender firstName middleName lastName birthName nickname title suffix clanId living
      birth { ${POINT} }
      death { ${POINT} cause }
      residencePlaceId occupation email phone avatarId note biography
      events { id type title date { ${DATE} } placeId description citations { ${CITATION} } }
      custom
      citations { ${CITATION} }
      favorite privacy createdAt updatedAt
    }
    families {
      id partners status children childLinks note
      marriage { ${POINT} }
      divorce { ${POINT} }
      citations { ${CITATION} }
    }
    places { id name type parentId lat lng altNames note }
    media { id kind title description date { ${DATE} } placeId personIds sourceId src thumb mime size createdAt }
    sources { id title type author repository callNumber url date { ${DATE} } note }
    clans { id name color description }
  }
`

// ------------------------------------------------------------------ auth
export const Q_ME = gql`
  ${USER_FIELDS}
  query Me { me { ...UserFields } }
`
export const M_LOGIN = gql`
  ${USER_FIELDS}
  mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { ${AUTH_PAYLOAD} } }
`
export const M_REGISTER = gql`
  ${USER_FIELDS}
  mutation Register($input: RegisterInput!) { register(input: $input) { ${AUTH_PAYLOAD} } }
`
export const M_REFRESH = gql`
  ${USER_FIELDS}
  mutation Refresh($refreshToken: String!) { refreshToken(refreshToken: $refreshToken) { ${AUTH_PAYLOAD} } }
`
export const M_LOGOUT = gql`
  mutation Logout($refreshToken: String) { logout(refreshToken: $refreshToken) }
`
export const M_REQUEST_RESET = gql`
  mutation RequestReset($email: String!) { requestPasswordReset(email: $email) }
`
export const M_RESET = gql`
  ${USER_FIELDS}
  mutation Reset($token: String!, $password: String!) { resetPassword(token: $token, password: $password) { ${AUTH_PAYLOAD} } }
`
export const M_VERIFY = gql`
  mutation Verify($token: String!) { verifyEmail(token: $token) }
`
export const M_RESEND = gql`
  mutation Resend { resendVerificationEmail }
`
export const M_UPDATE_PROFILE = gql`
  ${USER_FIELDS}
  mutation UpdateProfile($input: ProfileInput!) { updateProfile(input: $input) { ...UserFields } }
`
export const M_CHANGE_PASSWORD = gql`
  mutation ChangePassword($current: String!, $next: String!) { changePassword(current: $current, next: $next) }
`
export const M_DELETE_ACCOUNT = gql`
  mutation DeleteAccount($password: String!) { deleteAccount(password: $password) }
`

// ------------------------------------------------------------------ trees
export const Q_TREES = gql`
  ${TREE_SUMMARY_FIELDS}
  query Trees { trees { ...TreeSummaryFields } }
`
export const Q_TREE = gql`
  ${TREE_FIELDS}
  query Tree($id: ID!) { tree(id: $id) { ...TreeFields } }
`
export const Q_TREE_VERSION = gql`
  query TreeVersion($id: ID!) { tree(id: $id) { id version } }
`
export const M_CREATE_TREE = gql`
  ${TREE_SUMMARY_FIELDS}
  mutation CreateTree($input: CreateTreeInput!) { createTree(input: $input) { ...TreeSummaryFields } }
`
export const M_APPLY_CHANGES = gql`
  mutation ApplyChanges($treeId: ID!, $changes: TreeChangesInput!) { applyTreeChanges(treeId: $treeId, changes: $changes) { version updatedAt } }
`
export const M_DELETE_TREE = gql`
  mutation DeleteTree($id: ID!) { deleteTree(id: $id) }
`

// ------------------------------------------------------------------ media
export const M_CREATE_UPLOAD = gql`
  mutation CreateUpload($treeId: ID!, $filename: String!, $mime: String!, $size: Int!) {
    createUpload(treeId: $treeId, filename: $filename, mime: $mime, size: $size) { uploadUrl fileUrl thumbUrl headers }
  }
`

// ------------------------------------------------------------------ sharing
export const Q_MEMBERS = gql`
  query Members($treeId: ID!) {
    treeMembers(treeId: $treeId) { id role user { id name email avatar } invitedEmail status createdAt }
  }
`
export const M_INVITE = gql`
  mutation Invite($treeId: ID!, $email: String!, $role: TreeRole!) {
    inviteMember(treeId: $treeId, email: $email, role: $role) { id role invitedEmail status createdAt }
  }
`
export const M_UPDATE_MEMBER = gql`
  mutation UpdateMember($memberId: ID!, $role: TreeRole!) { updateMember(memberId: $memberId, role: $role) { id role } }
`
export const M_REMOVE_MEMBER = gql`
  mutation RemoveMember($memberId: ID!) { removeMember(memberId: $memberId) }
`
export const M_SHARE_LINK = gql`
  mutation ShareLink($treeId: ID!, $enabled: Boolean!) { setPublicLink(treeId: $treeId, enabled: $enabled) { url enabled } }
`
