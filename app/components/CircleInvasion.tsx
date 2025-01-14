import { useEffect, useState } from "react";
import styles from "./CircleInvasion.module.css";

interface Circle {
  id: number;
  x: number;
  y: number;
  color: string;
  borderColor: string;
  maxSize: number;
  currentSize: number;
  growing: boolean;
}

interface HighscoreEntry {
  nickname: string;
  score: number;
}

const CircleInvasion = () => {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([]);

  const gameAreaWidth = 800;
  const gameAreaHeight = 600;
  const spawnInterval = 500; // milliseconds
  const growthRate = 1; // pixels per frame

  useEffect(() => {
    const interval = setInterval(() => {
      const newCircle: Circle = {
        id: Date.now(),
        x: Math.random() * (gameAreaWidth - 200),
        y: Math.random() * (gameAreaHeight - 200),
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        borderColor: `hsl(${Math.random() * 360}, 100%, 20%)`,
        maxSize: 100,
        currentSize: 1,
        growing: true,
      };

      setCircles((prev) => [...prev, newCircle]);
    }, spawnInterval);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCircles((prev) => {
        return prev.map((circle) => {
          if (circle.growing && circle.currentSize < circle.maxSize) {
            return {
              ...circle,
              currentSize: circle.currentSize + growthRate,
            };
          } else if (circle.growing && circle.currentSize >= circle.maxSize) {
            return {
              ...circle,
              growing: false,
            };
          } else if (!circle.growing && circle.currentSize > 0) {
            return {
              ...circle,
              currentSize: circle.currentSize - growthRate,
            };
          } else {
            return circle;
          }
        });
      });
    }, 16);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const disappearingCircles = circles.filter(
      (circle) => circle.currentSize <= 0
    );

    if (disappearingCircles.length > 0) {
      setLives((prev) => prev - disappearingCircles.length);
      setCircles((prev) => prev.filter((circle) => circle.currentSize > 0));
    }

    if (lives <= 0) {
      const nickname =
        prompt(`Game Over! Your score: ${score}\nEnter your nickname:`) ||
        "Anonymous";
      const newHighscores = [...highscores, { nickname, score }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      setHighscores(newHighscores);

      setScore(0);
      setLives(3);
      setCircles([]);
    }
  }, [circles, lives, score, highscores]);

  const handleCircleClick = (id: number) => {
    setScore((prev) => prev + 1);
    setCircles((prev) => prev.filter((circle) => circle.id !== id));
  };

  return (
    <div
      className={styles.gameArea}
      style={{ width: gameAreaWidth, height: gameAreaHeight }}
    >
      {circles.map((circle) => (
        <div
          key={circle.id}
          className={styles.circle}
          style={{
            left: circle.x,
            top: circle.y,
            width: circle.currentSize,
            height: circle.currentSize,
            backgroundColor: circle.color,
            borderColor: circle.borderColor,
            transform: `translate(-50%, -50%)`,
          }}
          onClick={() => handleCircleClick(circle.id)}
        ></div>
      ))}
      <div className={styles.infoPanel}>
        <p>Score: {score}</p>
        <p>Lives: {lives}</p>
        <div className={styles.highscorePanel}>
          <h3>Highscores:</h3>
          <ol>
            {highscores.map((entry, index) => (
              <li key={index}>
                {entry.nickname}: {entry.score}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default CircleInvasion;
