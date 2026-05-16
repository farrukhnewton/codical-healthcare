import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Bookmark, RefreshCcw, Search, Star, Tag } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";

export function Favorites() {
  const { data: favorites = [], isLoading, isError, refetch } = useFavorites();
  const [query, setQuery] = useState("");

  const filteredFavorites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return favorites;
    return favorites.filter((favorite) =>
      favorite.code.toLowerCase().includes(normalized) ||
      favorite.description.toLowerCase().includes(normalized) ||
      favorite.codeType.toLowerCase().includes(normalized),
    );
  }, [favorites, query]);

  const codeTypes = useMemo(() => new Set(favorites.map((favorite) => favorite.codeType)).size, [favorites]);

  return (
    <div className="tool-page secondary-page favorites-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>Saved Workspace</h1>
          <p>Curated diagnosis and procedure codes for quick reference.</p>
        </div>
        <div className="search-header-meta">
          <span>{favorites.length} saved</span>
          <span>{codeTypes} code types</span>
        </div>
      </section>

      <section className="tool-panel secondary-command-panel">
        <label className="tool-search-field">
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved codes"
          />
        </label>
        <button type="button" className="tool-secondary-button" onClick={() => refetch()}>
          <RefreshCcw size={16} />
          Refresh
        </button>
      </section>

      {isError ? (
        <div className="tool-callout" data-tone="danger">
          <Bookmark size={17} />
          <span>Could not load saved codes. Use Refresh to try again.</span>
        </div>
      ) : null}

      <section className="tool-panel secondary-section-panel">
        <div className="secondary-section-head">
          <div>
            <h2>Saved Codes</h2>
            <p>{filteredFavorites.length} matching code references.</p>
          </div>
          <span className="secondary-count-pill">{filteredFavorites.length} visible</span>
        </div>

        {isLoading ? (
          <div className="secondary-skeleton-list">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="secondary-skeleton-row" key={index}>
                <span />
                <div>
                  <strong />
                  <small />
                </div>
              </div>
            ))}
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="tool-empty-state compact">
            <Star size={30} />
            <strong>{favorites.length === 0 ? "Start building your saved workspace" : "No saved codes match"}</strong>
            <span>Save frequently used codes from search and code detail pages.</span>
            <Link href="/search" className="tool-primary-button">
              <Search size={16} />
              Explore Codes
            </Link>
          </div>
        ) : (
          <div className="favorite-code-list">
            {filteredFavorites.map((favorite) => (
              <Link href={`/intel/${favorite.code}`} className="favorite-code-card" key={favorite.id}>
                <span className="favorite-code-chip">{favorite.code}</span>
                <div>
                  <strong>{favorite.description}</strong>
                  <small>
                    <Tag size={13} />
                    {favorite.codeType}
                  </small>
                </div>
                <span className="secondary-row-action">Open</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
