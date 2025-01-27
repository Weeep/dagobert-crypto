import { useEffect, useState } from "react";

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
  const [lives, setLives] = useState(10);
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([]);

  const spawnInterval = 500; // milliseconds
  const growthRate = 1; // pixels per frame

  useEffect(() => {
    const interval = setInterval(() => {
      const gameAreaWidth = window.innerWidth * 0.9;
      const gameAreaHeight = window.innerHeight * 0.9;

      const newCircle: Circle = {
        id: Date.now(),
        x: Math.random() * gameAreaWidth * 0.9,
        y: Math.random() * gameAreaHeight * 0.9,
        color: `red`, //`hsl(${Math.random() * 360}, 100%, 50%)`,
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
    <div className="w-screen h-screen flex justify-center items-center bg-gray-100 relative">
      <div className="w-[90%] h-[90%] relative border border-dashed border-red-500">
        {circles.map((circle) => (
          <div
            key={circle.id}
            className="absolute rounded-full cursor-pointer"
            style={{
              left: circle.x,
              top: circle.y,
              width: circle.currentSize,
              height: circle.currentSize,
              backgroundColor: circle.color,
              borderColor: circle.borderColor,
              borderWidth: 2,
              borderStyle: "solid",
              transform: `translate(-50%, -50%)`,
              zIndex: 50,
            }}
            onClick={() => handleCircleClick(circle.id)}
          ></div>
        ))}
        <div className="absolute top-2 left-2 bg-white/80 p-3 rounded-md text-gray-700">
          <p>Score: {score}</p>
          <p>Lives: {lives}</p>
          <div className="mt-3">
            <h3>Highscores:</h3>
            <ol className="list-decimal ml-5">
              {highscores.map((entry, index) => (
                <li key={index}>
                  {entry.nickname}: {entry.score}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircleInvasion;
