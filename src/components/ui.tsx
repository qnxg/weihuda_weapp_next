import {
  AlertCircle,
  ArrowLeft,
  Inbox,
  LockKeyhole,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function PageHeader({
  title,
  description,
  back = false,
  leadingAction,
  action,
}: {
  title: string;
  description?: ReactNode;
  back?: boolean;
  leadingAction?: ReactNode;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      <div className="cluster gap-12 min-w-0">
        {leadingAction}
        {back ? (
          <button className="icon-button" type="button" onClick={() => navigate(-1)} aria-label="返回">
            <ArrowLeft aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0">
          <h1>{title}</h1>
          {description ? <p className="muted text-sm text-clamp-2">{description}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section stack gap-12 ${className}`.trim()}>
      {title || action ? (
        <div className="section-heading cluster spread gap-12">
          <div className="min-w-0">
            {title ? <h2>{title}</h2> : null}
            {description ? <p className="muted text-sm text-pretty">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DataRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="data-row">
      <div className="min-w-0">
        <p className="data-row__label">{label}</p>
        {detail ? <div className="data-row__detail">{detail}</div> : null}
      </div>
      <div className="data-row__value">{value}</div>
    </div>
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack gap-12" aria-label="正在加载" role="status">
      <div className="skeleton skeleton--title" />
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <div className="skeleton skeleton--icon" />
          <div className="stack gap-8 flex-1">
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = error instanceof Error ? error.message : "页面加载失败，请稍后重试。";
  return (
    <div className="state-panel" role="alert">
      <AlertCircle aria-hidden="true" />
      <h2>暂时无法加载</h2>
      <p>{message}</p>
      {onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          重新加载
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="state-panel">
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function AuthPrompt({
  title = "登录后查看",
  description = "这里包含你的个人校园数据，登录后即可继续。",
}: {
  title?: string;
  description?: string;
}) {
  const { pathname, search, hash } = useLocation();
  const returnTo = `${pathname}${search}${hash}`;

  return (
    <div className="auth-prompt">
      <span className="auth-prompt__icon">
        <LockKeyhole aria-hidden="true" />
      </span>
      <div className="stack gap-4">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Link className="button button--primary" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        登录
      </Link>
    </div>
  );
}

export function StatusMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  return (
    <p className={`status-message status-message--${tone}`} aria-live="polite">
      {children}
    </p>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
  variant = "default",
  showClose = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "default" | "confirmation";
  showClose?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (triggerRef.current?.isConnected) {
        triggerRef.current.focus();
      } else {
        const heading = document.querySelector<HTMLHeadingElement>("#main-content h1");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus();
        }
      }
    };
  }, []);

  return (
    <dialog
      className={`modal modal--${variant}`}
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal__header cluster spread gap-12">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p className="muted text-sm" id={descriptionId}>{description}</p> : null}
        </div>
        {showClose ? (
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const close = () => {
    if (!pending) onCancel();
  };

  return (
    <Modal title={title} description={description} onClose={close} variant="confirmation" showClose={false}>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      <div className="modal__actions">
        <button className="button button--tonal" type="button" disabled={pending} onClick={close}>
          取消
        </button>
        <button className="button button--danger" type="button" disabled={pending} onClick={onConfirm}>
          {pending ? "处理中…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
