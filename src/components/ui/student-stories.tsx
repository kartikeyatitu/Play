import { AvatarRing } from './avatar-ring';

interface Student {
  id: string;
  name: string;
  attendancePercentage?: number;
}

export function StudentStories({ students, onStudentClick }: {
  students: Student[];
  onStudentClick?: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {students.map(s => (
        <button key={s.id} onClick={() => onStudentClick?.(s.id)}
          className="flex-shrink-0 hover:scale-105 transition-transform">
          <AvatarRing name={s.name} percentage={s.attendancePercentage || 0} />
        </button>
      ))}
    </div>
  );
}
