interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  change?: string;
  positive?: boolean;
  loading?: boolean;
  colorClass?: string;
}

export default function StatCard({
  icon, label, value, sub, change, positive, loading, colorClass = 'bg-primary-50',
}: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${colorClass} flex items-center justify-center text-xl flex-shrink-0`}>
          {icon}
        </div>
        {change && (
          <span className={`badge text-xs font-bold ${
            positive ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
          }`}>
            {positive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-8 w-20 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      ) : (
        <>
          <div className="text-3xl font-display font-bold text-gray-900 mb-0.5">{value}</div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}
