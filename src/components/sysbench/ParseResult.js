import { useEffect, useState } from "react";
import LineChart from "./LineChart";
import BarChart from "./BarChart";

import { Card } from "@material-tailwind/react";
import { propTypesSelected } from "@material-tailwind/react/types/components/select";

const ParseResult = ({ files }) => {
  const [queryResults, setQueryResults] = useState([]);

  useEffect(() => {
    const loadFiles = async () => {
      if (files && files.length > 0) {
        const fileContents = [];

        for (const file of files) {
          const fileContent = await readFile(file);
          const results = extractResults(fileContent);
          const avgTps = extractAvgTps(fileContent);

          fileContents.push({ results, avgTps });
        }

        setQueryResults(fileContents);
      } else {
        // 업로드 한 파일 없는 경우
        setQueryResults([]);
      }
    };

    loadFiles();
  }, [files]);

  const readFile = (file) => {
    return new Promise((resolve) => {
      const fileReader = new FileReader();

      fileReader.onload = () => {
        resolve(fileReader.result);
      };

      // read the file as text
      fileReader.readAsText(file);
    });
  };

  /* input preprocessing + query result update */
  const extractResults = (content) => {
    const regex =
      /\[\s*(\d+s)\s*\]\s*thds:\s*(\d+)\s*tps:\s*([\d.]+)\s*qps:\s*([\d.]+).*lat\s*\(ms,99%\):\s*([\d.]+)\s*err\/s:\s*([\d.]+)/;
    let match = null;
    const results = [];

    const lines = content.toString().split("\n");

    for (let line of lines) {
      // Stop at Latency histogram
      if (line.includes("Latency histogram (values are in milliseconds)")) {
        break;
      }

      match = line.match(regex);

      if (match) {
        const [_, time, thds, tps, qps, lat, err] = match;
        results.push({
          time: parseInt(time),
          tps: parseFloat(tps),
          qps: parseFloat(qps),
          lat: parseFloat(lat),
        });
      }
    }
    return results;
  };

  const extractAvgTps = (content) => {
    const regex = /transactions:\s+\d+\s+\(([\d.]+)\s+per sec.\)/;
    const match = content.match(regex);

    if (match) {
      const transactionsPerSec = parseFloat(match[1]); // per sec 값 추출
      return transactionsPerSec;
    } else {
      console.error("Unable to extract average from the content");
      return null;
    }
  };

  return (
    <div>
      {/* <Card> */}
      <h1 className="title">Benchmark Result</h1>
      {/* 차트 여러개인 경우 두개씩 보이도록 */}
      {queryResults.length >= 1 && (
        <div>
          <div className="sysbench-container">
            {queryResults.map((results, index) => (
              <LineChart
                key={index}
                width={0.3 * document.documentElement.clientWidth}
                margin={0.03 * document.documentElement.clientWidth}
                queryResults={results.results}
                avgTps={results.avgTps}
                files={files}
                name={files.name}
              />
            ))}
          </div>
        </div>
      )}
      {/* </Card> */}
      <div>
        <BarChart files={files} />
      </div>
    </div>
  );
};

export default ParseResult;
