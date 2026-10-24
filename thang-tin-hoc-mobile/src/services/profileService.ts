import type { ApiClient } from './apiClient';
import type {
  ProfileRole,
  ProfileUpdate,
  ProfileViewModel,
  StudentProfileUpdate,
  TeacherProfileUpdate,
} from './profileTypes';

type ProfileResponse = {
  success?: boolean;
  data?: unknown;
  message?: string;
};

type RecordValue = Record<string, unknown>;

export class ProfileApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function asText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function asNestedText(value: unknown, key: string): string {
  return asText(asRecord(value)[key]);
}

function mapProfile(role: ProfileRole, value: unknown): ProfileViewModel {
  const data = asRecord(value);
  const id = asText(data._id) || asText(data.id);
  if (!id || !asText(data.name)) {
    throw new ProfileApiError('Máy chủ trả về hồ sơ không hợp lệ.');
  }

  if (role === 'student') {
    return {
      id,
      role,
      name: asText(data.name),
      code: asText(data.studentCode) || asText(data.code),
      phone: asText(data.phone),
      email: asText(data.email),
      zalo: asText(data.zalo),
      address: asText(data.address),
      status: asText(data.status),
      gender: asText(data.gender),
      age: asText(data.age),
      course: asText(data.course),
      specialty: '',
      bio: '',
      voiceRegion: '',
      bankAccount: '',
    };
  }

  return {
    id,
    role,
    name: asText(data.name),
    code: asText(data.teacherCode) || asText(data.code),
    phone: asText(data.phone),
    email: asText(data.email),
    zalo: asText(data.zalo),
    address: asText(data.address),
    status: asText(data.status),
    gender: asText(data.gender),
    age: asText(data.age),
    course: '',
    specialty: asText(data.specialty),
    bio: asText(data.bio),
    voiceRegion: asText(data.voiceRegion),
    bankAccount: asNestedText(data.bankAccount, 'accountNumber'),
  };
}

function profileData(response: ProfileResponse): unknown {
  if (response.success !== true || response.data === null || response.data === undefined) {
    throw new ProfileApiError(response.message || 'Máy chủ không trả về hồ sơ.');
  }
  return response.data;
}

function endpoint(role: ProfileRole, id: string): string {
  const collection = role === 'student' ? 'students' : 'teachers';
  return `/api/${collection}/${encodeURIComponent(id)}`;
}

function updateBody(role: ProfileRole, payload: ProfileUpdate): StudentProfileUpdate | TeacherProfileUpdate {
  if (role === 'student') {
    if ('bio' in payload || 'voiceRegion' in payload || 'age' in payload) {
      throw new ProfileApiError('Dữ liệu cập nhật không thuộc hồ sơ học viên.');
    }
    return {
      email: payload.email,
      zalo: payload.zalo,
      address: payload.address,
    };
  }
  if (!('bio' in payload)) {
    throw new ProfileApiError('Dữ liệu cập nhật không thuộc hồ sơ giáo viên.');
  }
  return {
    email: payload.email,
    zalo: payload.zalo,
    bio: payload.bio,
    voiceRegion: payload.voiceRegion,
    address: payload.address,
    age: payload.age,
  };
}

async function getProfile(client: ApiClient, role: ProfileRole, id: string): Promise<ProfileViewModel> {
  const response = await client.get<ProfileResponse>(endpoint(role, id));
  return mapProfile(role, profileData(response));
}

function updateProfile(
  client: ApiClient,
  role: 'student',
  id: string,
  payload: StudentProfileUpdate,
): Promise<ProfileViewModel>;
function updateProfile(
  client: ApiClient,
  role: 'teacher',
  id: string,
  payload: TeacherProfileUpdate,
): Promise<ProfileViewModel>;
async function updateProfile(
  client: ApiClient,
  role: ProfileRole,
  id: string,
  payload: ProfileUpdate,
): Promise<ProfileViewModel> {
  const response = await client.put<ProfileResponse>(endpoint(role, id), updateBody(role, payload));
  return mapProfile(role, profileData(response));
}

export const profileService = { getProfile, updateProfile };
