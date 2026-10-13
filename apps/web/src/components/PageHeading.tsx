import { Link } from 'react-router-dom';
import { LineIcon } from './PixelIcon';
export function PageHeading({
  title,
  back = '/',
  onBack,
}: {
  title: string;
  back?: string;
  onBack?: () => void;
}) {
  return (
    <header className="page-heading">
      {onBack ? (
        <button className="icon-button" onClick={onBack} aria-label="返回">
          <LineIcon name="back" size={20} />
        </button>
      ) : (
        <Link className="icon-button" to={back} aria-label="返回">
          <LineIcon name="back" size={20} />
        </Link>
      )}
      <h1>{title}</h1>
      <span />
    </header>
  );
}
