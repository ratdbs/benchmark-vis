import QueryPlanView from "./QueryPlanView";
import CompareView from "./CompareView";
import "../../assets/stylesheets/Tpch.css";
import { Card } from "@material-tailwind/react";

function Tpch({ files }) {
  const size = 1000;
  const width = 430;
  const height = 200; 
  const margin = 20;
  const radius = 1.5;
  const barPadding = 0.3;

  return (
    <div className="App">
      <div className="query-plan-container">
        <Card>
          <QueryPlanView files={files} />
        </Card>
      </div>
      <div className="comparison-view-container">
      <Card>
        <CompareView
           files={files}
           size={size}
           height={height}
           width={width}
           margin={margin}
           radius={radius}
           barPadding={barPadding}
        />
      </Card>
      </div>
    </div>
  );
}

export default Tpch;