export default function ChangeCountBadge({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span className="size-3.5 text-[9px] font-medium rounded-full flex items-center justify-center bg-yellow-500 text-black">
      {count > 99 ? '99+' : count}
    </span>
  )
}
