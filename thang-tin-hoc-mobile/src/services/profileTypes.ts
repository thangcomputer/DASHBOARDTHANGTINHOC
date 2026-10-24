export type ProfileRole = 'student' | 'teacher';

export type StudentProfileUpdate = {
  email: string;
  zalo: string;
  address: string;
};

export type TeacherProfileUpdate = {
  email: string;
  zalo: string;
  bio: string;
  voiceRegion: string;
  address: string;
  age: number | null;
};

export type ProfileUpdate = StudentProfileUpdate | TeacherProfileUpdate;

export type ProfileViewModel = {
  id: string;
  role: ProfileRole;
  name: string;
  code: string;
  phone: string;
  email: string;
  zalo: string;
  address: string;
  status: string;
  gender: string;
  age: string;
  course: string;
  specialty: string;
  bio: string;
  voiceRegion: string;
  bankAccount: string;
};
