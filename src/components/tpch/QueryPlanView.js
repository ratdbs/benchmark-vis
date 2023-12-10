import { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";
import { nodeColor, PostgresToMySQL, MySqlToPostgres } from "./mapping";

const QueryPlanView = (props) => {
  const treeSvg = useRef(null);

  const width = props.width;
  const height = 640;
  const marginY = 35;

  // data를 d3의 계층 구조로 바꾸어주기
  const root = d3.hierarchy(props.plan);

  const dx = width / 4;
  const dy = height / (1 + root.height);

  const treeLayout = d3.tree().nodeSize([dx, dy]);
  const treeData = treeLayout(root);
  const diagonal = d3
    .linkVertical()
    .x((d) => d.x)
    .y((d) => d.y);

  // query cost 계산
  const cost = treeData.links().map((link) => {
    if (link.target.data["Total Cost"]) {
      // PostgreSQL
      return link.target.data["Total Cost"] - link.target.data["Startup Cost"];
    } else if (link.target.data["cost_info"]) {
      // MySQL
      return d3.sum(
        Object.entries(link.target.data.cost_info || {})
          .filter(([key]) => key.includes("cost"))
          .map(([_, value]) => parseFloat(value) || 0)
      );
    } else if (link.target.data["r_total_time_ms"]) {
      // MariaDB
      return link.target.data["r_total_time_ms"];
    }

    return 0;
  });

  // # of rows 계산
  const rows = treeData.links().map((link) => {
    if (link.target.data["Plan Rows"]) {
      // PostgreSQL
      return link.target.data["Plan Rows"];
    } else if (link.target.data["cost_info"]) {
      // MySQL
      return d3.sum(
        Object.entries(link.target.data || {})
          .filter(([key]) => key.includes("rows"))
          .map(([_, value]) => value || 0)
      );
    } else if (link.target.data["r_total_time_ms"]) {
      // MariaDB
      return link.target.data["rows"];
    }
    return 0;
  });

  // scale for node radius
  const rowScale = d3
    .scaleLinear()
    .domain([d3.min(rows), d3.max(rows)])
    .range([10, 30]);

  const costScale = d3
    .scaleLinear()
    .domain([d3.min(cost), d3.max(cost)])
    .range([10, 30]);

  const drawTree = (term, metric) => {
    const svg = d3
      .select(treeSvg.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height + 2 * marginY)
      .append("g") // 그룹으로 묶어서
      .attr("transform", `translate(${width / 2}, ${marginY})`) // margin 적용
      .call(
        d3.zoom().on("zoom", (event) => {
          svg.attr("transform", event.transform);
        })
      )
      .append("g");

    svg
      .selectAll("path")
      .data(root.links())
      .enter()
      .append("path")
      .attr("d", diagonal)
      .attr("fill", "none")
      .attr("stroke", "lightgrey");

    // create nodes
    const nodes = svg
      .selectAll("g")
      .data(treeData.descendants())
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    nodes
      .append("circle")
      .transition()
      .duration(1000)
      .attr("fill", (d) => nodeColor(d.data["Node Type"]))
      .attr("r", (d, idx) => {
        if (metric === "cost") {
          return cost[idx - 1] ? costScale(cost[idx - 1]) : 10;
        } else if (metric === "rows") {
          return rows[idx - 1] ? rowScale(rows[idx - 1]) : 10;
        } else {
          return 15;
        }
      });

    // append "Node Type" as node label
    nodes
      .append("text")
      .attr("id", "node-type")
      .attr("text-anchor", "start")
      .text((d) => {
        if (term === "PostgreSQL")
          return MySqlToPostgres[d.data["Node Type"]] || d.data["Node Type"];
        else if (term === "MariaDB / MySQL")
          return PostgresToMySQL[d.data["Node Type"]] || d.data["Node Type"];
        else return d.data["Node Type"];
      });

    // append "Relation Name" or "table_name"
    nodes
      .append("text")
      .attr("id", "relation-name")
      .attr("class", "relation-name")
      .attr("dy", 12)
      .attr("text-anchor", "start")
      .text((d) =>
        d.data["Relation Name"]
          ? d.data["Relation Name"].toUpperCase()
          : d.data.table_name
          ? d.data.table_name.toUpperCase()
          : null
      );

    // create tooltip
    var tooltip = d3
      .select("body")
      .append("div")
      .attr("id", "tooltip")
      .attr("class", "node-tooltip");

    nodes
      .on("mouseover", function (event, d) {
        tooltip.html(tooltipContent(d)).style("visibility", "visible");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", event.pageY - 50 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
      });
  };

  const updateTree = (term, metric) => {
    const svg = d3.select(treeSvg.current);

    // update nodes
    svg
      .selectAll("circle")
      .transition()
      .duration(1000)
      .attr("r", (d, idx) => {
        if (metric === "cost") {
          return cost[idx - 1] ? costScale(cost[idx - 1]) : 10;
        } else if (metric === "rows") {
          return rows[idx - 1] ? rowScale(rows[idx - 1]) : 10;
        } else {
          return 15;
        }
      });

    // update terminology
    svg
      .selectAll("#node-type")
      .attr("text-anchor", "start")
      .text((d) => {
        if (term === "PostgreSQL")
          return MySqlToPostgres[d.data["Node Type"]] || d.data["Node Type"];
        else if (term === "MariaDB / MySQL")
          return PostgresToMySQL[d.data["Node Type"]] || d.data["Node Type"];
        else return d.data["Node Type"];
      });
  };

  useEffect(() => {
    d3.select(treeSvg.current).selectAll("*").remove(); // clear
    drawTree(props.term, props.metric);
  }, [props.plan]);

  useEffect(() => {
    updateTree(props.term, props.metric);
  }, [props.term, props.metric]);

  function expandNode(nodeElem) {
    d3.select(nodeElem).html((d) => {
      const keyValuePairs = Object.entries(d.data);
      let detail;
      keyValuePairs.map(([key, value]) => {
        detail += `${key}: ${value} `;
      });

      return detail;
    });
  }

  function tooltipContent(d) {
    let content = `<table class="tooltip-table"><tr><td>Node Type</td><td>${d.data["Node Type"]}</td></tr>`;

    if (d.data["Node Type"] !== "Limit") {
      if (d.data["Total Cost"]) {
        // PostgreSQL
        if (d.data["Relation Name"]) {
          content += `<tr><td>Relation Name</td><td>${d.data[
            "Relation Name"
          ].toUpperCase()}</td></tr>`;
        }

        content += `<tr><td>Cost</td><td>${(
          d.data["Total Cost"] - d.data["Startup Cost"]
        ).toFixed(2)}</td></tr>`;

        content += `<tr><td>Plan Rows</td><td>${d.data["Plan Rows"]}</td></tr>`;
        content += `<tr><td>Plan Width</td><td>${d.data["Plan Width"]}</td></tr>`;
      } else if (d.data["cost_info"]) {
        // MySQL
        if (d.data["table_name"]) {
          content += `<tr><td>Relation Name</td><td>${d.data[
            "table_name"
          ].toUpperCase()}</td></tr>`;
        }

        const totalCost = Object.entries(d.data.cost_info || {})
          .filter(([key]) => key.includes("cost"))
          .map(([_, value]) => parseFloat(value) || 0);

        content += `<tr><td>Cost</td><td>${d3
          .sum(totalCost)
          .toFixed(2)}</td></tr>`;
      } else if (d.data["r_total_time_ms"]) {
        // MariaDB
        if (d.data["table_name"]) {
          content += `<tr><td>Relation Name</td><td>${d.data[
            "table_name"
          ].toUpperCase()}</td></tr>`;
        }

        content += `<tr><td>Cost</td><td>${d.data["r_total_time_ms"].toFixed(
          2
        )}</td></tr>`;
      }
    }

    const keyValuePairs = Object.entries(d.data).filter(
      (key) =>
        ![
          "children",
          "Node Type",
          "table_name",
          "cost_info",
          "Total Cost",
          "Startup Cost",
          "r_total_time_ms",
        ].includes(key[0])
    );

    content += keyValuePairs
      .map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`)
      .join("");

    content += `</table>`;

    return content;
  }

  return (
    <div>
      <svg
        className="node-label"
        ref={treeSvg}
        width={width}
        height={height + 2 * marginY}
      ></svg>
    </div>
  );
};

export default QueryPlanView;
