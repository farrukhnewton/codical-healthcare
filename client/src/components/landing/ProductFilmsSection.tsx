import { ExternalLink, Play } from "lucide-react";

type YouTubeStory = {
  title: string;
  source: string;
  videoId: string;
  note: string;
};

const YOUTUBE_STORIES: YouTubeStory[] = [
  {
    title: "Phelps Memorial RCM workflow story",
    source: "Inovalon",
    videoId: "k9GXupX1TSs",
    note: "A public healthcare revenue-cycle story about improving RCM workflows.",
  },
  {
    title: "O'Neal Medical revenue cycle story",
    source: "Brightree",
    videoId: "KpTPlGfE_sY",
    note: "A public customer story about medical revenue-cycle operations.",
  },
];

function YouTubeThumbnail({ story }: { story: YouTubeStory }) {
  const videoUrl = `https://www.youtube.com/watch?v=${story.videoId}`;

  return (
    <a
      className="nex-video-youtube-link"
      href={videoUrl}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`Watch ${story.title} on YouTube`}
    >
      <img
        src={`https://i.ytimg.com/vi/${story.videoId}/maxresdefault.jpg`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = `https://i.ytimg.com/vi/${story.videoId}/hqdefault.jpg`;
        }}
        alt={`${story.title} video thumbnail`}
        loading="lazy"
      />
      <span aria-hidden="true"><Play size={24} fill="currentColor" /></span>
      <small>Watch on YouTube <ExternalLink size={12} /></small>
    </a>
  );
}

export function ProductFilmsSection() {
  return (
    <section className="nex-video-stories" id="stories" aria-labelledby="video-stories-title">
      <div className="nex-section-center">
        <span className="nex-section-label">Healthcare revenue voices</span>
        <h2 id="video-stories-title">Hear from medical billing and RCM professionals.</h2>
        <p>Public healthcare revenue-cycle stories. Select a video to watch it directly on YouTube.</p>
      </div>

      <div className="nex-video-grid">
        {YOUTUBE_STORIES.map((story) => (
          <article className="nex-video-card" key={story.videoId}>
            <div className="nex-video-frame">
              <YouTubeThumbnail story={story} />
            </div>
            <div className="nex-video-copy">
              <small>{story.source}</small>
              <h3>{story.title}</h3>
              <p>{story.note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
