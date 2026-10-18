import { AlertCircle, ExternalLink, Megaphone, RotateCcw } from "lucide-react";
import type { Announcement } from "../api/types";
import { formatDateTime } from "../utils/format";

function AnnouncementHeading({ id }: { id?: string }) {
  return (
    <div className="today-announcements__heading">
      <Megaphone aria-hidden="true" />
      <h2 id={id}>公告</h2>
    </div>
  );
}

export function TodayAnnouncements({
  announcements,
  isPending,
  error,
  onRetry,
}: {
  announcements: readonly Announcement[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (announcements === undefined && isPending) {
    return (
      <div
        className="today-announcements today-announcements__loading"
        role="status"
        aria-label="正在加载公告"
      >
        <AnnouncementHeading />
        {Array.from({ length: 2 }, (_, index) => (
          <div className="today-announcement-skeleton" key={index}>
            <div className="stack gap-8">
              <div className="skeleton skeleton--line skeleton--short" />
              <div className="skeleton skeleton--line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (announcements === undefined && error) {
    return (
      <div className="today-announcements today-announcements__error" role="alert">
        <AlertCircle aria-hidden="true" />
        <p>公告暂时无法加载</p>
        <button
          className="icon-button"
          type="button"
          aria-label="重新加载公告"
          title="重新加载公告"
          onClick={onRetry}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (!announcements?.length) return null;

  return (
    <section className="today-announcements" aria-labelledby="today-announcements-heading">
      <div className="today-announcement-list">
        <AnnouncementHeading id="today-announcements-heading" />
        {announcements.map((announcement) => (
          <article
            className={`today-announcement${announcement.url ? " has-action" : ""}`}
            key={announcement.id}
          >
            <div className="today-announcement__heading">
              <h3>{announcement.title}</h3>
              <time dateTime={announcement.created_at.replace(" ", "T")}>
                {formatDateTime(announcement.created_at)}
              </time>
            </div>
            <p className="today-announcement__content">{announcement.content}</p>
            {announcement.url ? (
              <a
                className="today-announcement__action"
                href={announcement.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`查看${announcement.title}详情`}
                title="查看公告详情"
              >
                <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
