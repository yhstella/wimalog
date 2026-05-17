// localStorage 추상화. 추후 Supabase 등 백엔드로 교체할 수 있도록 단일 진입점으로 관리.
const KEYS = {
  users: 'gl_users',
  logs:  'gl_logs',           // 주간 체중/증상 로그 (WeeklyLog)
  medCourses: 'gl_med_courses', // 약 사용 코스
  doses: 'gl_doses',           // 투약 기록
  exercises: 'gl_exercises',   // 운동 기록
  diets: 'gl_diets',           // 식단 기록
  session: 'gl_session',
  seeded: 'gl_seeded_v4',  // v4: real clinical data + Korea prices + 1000 users
  migrated: 'gl_migrated_v2',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeCollection(key) {
  return {
    all: () => read(key, []),
    set: (list) => write(key, list),
    byUser: (userId) => read(key, [])
      .filter(x => x.userId === userId)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    add: (item) => {
      const list = read(key, []);
      list.push(item);
      write(key, list);
      return item;
    },
    update: (item) => {
      const list = read(key, []);
      const idx = list.findIndex(x => x.id === item.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...item };
      write(key, list);
    },
    remove: (id) => {
      write(key, read(key, []).filter(x => x.id !== id));
    },
    removeByUser: (userId) => {
      write(key, read(key, []).filter(x => x.userId !== userId));
    },
  };
}

const usersCol     = { all: () => read(KEYS.users, []), set: (l) => write(KEYS.users, l) };
const logsCol      = makeCollection(KEYS.logs);
const medsCol      = makeCollection(KEYS.medCourses);
const dosesCol     = makeCollection(KEYS.doses);
const exercisesCol = makeCollection(KEYS.exercises);
const dietsCol     = makeCollection(KEYS.diets);

export const Storage = {
  // ---- users ----
  getUsers: usersCol.all,
  setUsers: usersCol.set,
  upsertUser(user) {
    const list = usersCol.all();
    const idx = list.findIndex(u => u.id === user.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...user };
    else list.push(user);
    usersCol.set(list);
    return user;
  },
  getUser(id) { return usersCol.all().find(u => u.id === id) || null; },
  deleteUser(id) {
    usersCol.set(usersCol.all().filter(u => u.id !== id));
    logsCol.removeByUser(id);
    medsCol.removeByUser(id);
    dosesCol.removeByUser(id);
    exercisesCol.removeByUser(id);
    dietsCol.removeByUser(id);
    if (Storage.getSession() === id) Storage.setSession(null);
  },

  // ---- weekly logs (체중/증상) ----
  getLogs: logsCol.all,
  setLogs: logsCol.set,
  getLogsByUser: logsCol.byUser,
  addLog: logsCol.add,
  updateLog: logsCol.update,
  deleteLog: logsCol.remove,

  // ---- med courses ----
  getMedCourses: medsCol.all,
  setMedCourses: medsCol.set,
  getMedCoursesByUser: medsCol.byUser,
  addMedCourse: medsCol.add,
  updateMedCourse: medsCol.update,
  deleteMedCourse(id) {
    medsCol.remove(id);
    // 코스 삭제 시 연결된 dose도 삭제
    dosesCol.set(dosesCol.all().filter(d => d.courseId !== id));
  },

  // ---- dose entries (투약 기록) ----
  getDoses: dosesCol.all,
  getDosesByUser: dosesCol.byUser,
  getDosesByCourse: (courseId) => dosesCol.all()
    .filter(d => d.courseId === courseId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
  addDose: dosesCol.add,
  updateDose: dosesCol.update,
  deleteDose: dosesCol.remove,

  // ---- exercises ----
  getExercises: exercisesCol.all,
  getExercisesByUser: exercisesCol.byUser,
  addExercise: exercisesCol.add,
  updateExercise: exercisesCol.update,
  deleteExercise: exercisesCol.remove,

  // ---- diets ----
  getDiets: dietsCol.all,
  getDietsByUser: dietsCol.byUser,
  addDiet: dietsCol.add,
  updateDiet: dietsCol.update,
  deleteDiet: dietsCol.remove,

  // ---- session ----
  getSession() { return read(KEYS.session, null); },
  setSession(userId) {
    if (userId == null) localStorage.removeItem(KEYS.session);
    else write(KEYS.session, userId);
  },

  // ---- seed flag ----
  isSeeded() { return read(KEYS.seeded, false); },
  markSeeded() { write(KEYS.seeded, true); },
  resetSeed() { localStorage.removeItem(KEYS.seeded); },

  // ---- migration v1 -> v2: 기존 user.medication/startDate를 medCourse로 분리 ----
  isMigrated() { return read(KEYS.migrated, false); },
  markMigrated() { write(KEYS.migrated, true); },
  migrateV1ToV2() {
    if (Storage.isMigrated()) return;
    const users = usersCol.all();
    const courses = medsCol.all();
    for (const u of users) {
      if (u.medication && u.startDate && !courses.find(c => c.userId === u.id)) {
        courses.push({
          id: uid('mc'),
          userId: u.id,
          seed: !!u.seed,
          medication: u.medication,
          startDate: u.startDate,
          endDate: u.discontinued ? null : null,
          initialDose: u.currentDose || null,
          notes: '온보딩에서 자동 이관',
          discontinueReason: u.discontinueReason || null,
          createdAt: u.createdAt || new Date().toISOString(),
        });
      }
    }
    medsCol.set(courses);
    Storage.markMigrated();
  },

  // ---- export ----
  exportUserData(userId) {
    return {
      user:      Storage.getUser(userId),
      logs:      logsCol.byUser(userId),
      medCourses: medsCol.byUser(userId),
      doses:     dosesCol.byUser(userId),
      exercises: exercisesCol.byUser(userId),
      diets:     dietsCol.byUser(userId),
      exportedAt: new Date().toISOString(),
    };
  },
};

export function uid(prefix = 'u') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
