/*
 * BusPal — Feedback & SOS PDF Report Generator
 *
 * IMPORTANT:
 * - Clicking "Generate Report" now PREVIEWS the PDF instead of downloading it.
 * - The browser's PDF viewer provides the Download button.
 * - All existing report layout, tables and charts are kept.
 * - The preview window is opened BEFORE the async jsPDF loader finishes,
 *   which prevents popup blockers from stopping the preview.
 */

(() => {
  const C = {
    navy:[17,58,112], blue:[45,105,225], blueLight:[235,243,255],
    green:[22,163,74], red:[220,38,38], orange:[217,119,6],
    text:[35,48,65], muted:[91,105,126], border:[211,220,231],
    panel:[248,250,253], white:[255,255,255]
  };

  const P = {left:16,right:194,top:16,bottom:281,width:210};

  function loadJsPDF() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);

    return new Promise((resolve,reject) => {
      const old = document.querySelector('script[data-buspal-jspdf="true"]');

      if (old) {
        if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
        old.addEventListener("load",() =>
          window.jspdf?.jsPDF
            ? resolve(window.jspdf.jsPDF)
            : reject(new Error("jsPDF unavailable")),
          {once:true}
        );
        old.addEventListener("error",() => reject(new Error("jsPDF failed to load")),{once:true});
        return;
      }

      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
      s.async = true;
      s.dataset.buspalJspdf = "true";

      s.onload = () =>
        window.jspdf?.jsPDF
          ? resolve(window.jspdf.jsPDF)
          : reject(new Error("jsPDF unavailable"));

      s.onerror = () => reject(new Error("Could not load jsPDF"));
      document.head.appendChild(s);
    });
  }

  const arr = x => Array.isArray(x) ? x : [];
  const text = (x,fallback="Unknown") =>
    x == null || String(x).trim()==="" ? fallback : String(x);

  const status = x => text(x,"unknown").toLowerCase().trim();
  const resolvedFB = x => ["closed","resolved"].includes(status(x.status));
  const resolvedSOS = x => status(x.status)==="resolved";

  const date = x => {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
  };

  const dateTime = x => {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? text(x,"—") : d.toLocaleString("en-GB");
  };

  const short = (x,n=22) => {
    const s = text(x);
    return s.length>n ? s.slice(0,n-1)+"…" : s;
  };

  function countBy(items,getter) {
    const m = new Map();
    items.forEach(x => {
      const k = text(getter(x));
      m.set(k,(m.get(k)||0)+1);
    });
    return [...m.entries()]
      .map(([label,value])=>({label,value}))
      .sort((a,b)=>b.value-a.value);
  }

  const typeData = fb => countBy(fb,x=>x.type);

  function feedbackStatus(fb) {
    return [
      {label:"Open / active",value:fb.filter(x=>!resolvedFB(x)).length},
      {label:"Resolved",value:fb.filter(resolvedFB).length}
    ].filter(x=>x.value);
  }

  function sosStatus(sos) {
    return [
      {label:"Open",value:sos.filter(x=>!resolvedSOS(x)).length},
      {label:"Resolved",value:sos.filter(resolvedSOS).length}
    ].filter(x=>x.value);
  }

  function sosTrend(sos) {
    const m = new Map();

    sos.forEach(x => {
      const d = new Date(x.createdAt);
      if (!Number.isNaN(d.getTime())) {
        const k = d.toISOString().slice(0,10);
        m.set(k,(m.get(k)||0)+1);
      }
    });

    return [...m.entries()]
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([k,v])=>({label:date(k),value:v}));
  }

  const sosByTrip = sos => countBy(sos,x=>x.trip);

  const fill = (doc,c) => doc.setFillColor(...c);
  const draw = (doc,c) => doc.setDrawColor(...c);
  const font = (doc,c) => doc.setTextColor(...c);

  function box(doc,x,y,w,h,fillIt=true) {
    doc.roundedRect(x,y,w,h,3,3,fillIt?"FD":"S");
  }


  /* ---- BusPal logo for the PDF header (loaded once, safe if it fails) ---- */
  let LOGO_DATA = null;

  async function loadLogoData() {
    if (LOGO_DATA) return LOGO_DATA;
    try {
      const url = new URL("../shared/assets/logo.png", document.baseURI).href;
      const response = await fetch(url);
      if (!response.ok) throw new Error("logo " + response.status);
      const blob = await response.blob();
      LOGO_DATA = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("logo read failed"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn("BusPal logo could not be loaded for the PDF.", error);
      LOGO_DATA = null;
    }
    return LOGO_DATA;
  }

  function drawLogo(doc, x, y, size) {
    if (!LOGO_DATA) return false;
    try {
      doc.addImage(LOGO_DATA, "PNG", x, y, size, size);
      return true;
    } catch (error) {
      console.warn("BusPal logo could not be drawn.", error);
      return false;
    }
  }

  function header(doc,page,total) {
    fill(doc,C.blue);
    doc.rect(0,0,210,3,"F");

    // logo first; text shifts right only when the logo really drew
    const logoShift = drawLogo(doc,P.left,5,9) ? 11 : 0;

    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.text("BusPal",P.left+logoShift,11);

    font(doc,C.muted);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    doc.text("Feedback & SOS Report",P.left+logoShift+19,11);

    if(total) {
      doc.text(`Page ${page} of ${total}`,P.right,11,{align:"right"});
    }
  }

  function footer(doc) {
    draw(doc,C.border);
    doc.setLineWidth(.25);
    doc.line(P.left,286,P.right,286);

    font(doc,C.muted);
    doc.setFontSize(6.8);
    doc.text("BusPal • Smart Bus Transportation Platform",P.left,291);
    doc.text("Generated automatically",P.right,291,{align:"right"});
  }

  function title(doc,t,sub) {
    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.text(t,P.left,28);

    font(doc,C.muted);
    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.text(sub,P.left,35);

    draw(doc,C.border);
    doc.line(P.left,40,P.right,40);
  }

  function reportDate(doc) {
    const d = new Date().toLocaleDateString("en-GB",{
      day:"2-digit",month:"long",year:"numeric"
    });

    fill(doc,C.blueLight);
    draw(doc,[190,207,232]);
    box(doc,150,16,44,22,true);

    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(6.5);
    doc.text("REPORT DATE",154,23);

    font(doc,C.text);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.text(d,154,30);
  }

  function card(doc,x,y,w,value,label,color) {
    fill(doc,C.white);
    draw(doc,C.border);
    box(doc,x,y,w,25,true);

    fill(doc,color);
    doc.roundedRect(x,y,2.2,25,1,1,"F");

    font(doc,color);
    doc.setFont("helvetica","bold");
    doc.setFontSize(16);
    doc.text(String(value),x+6,y+10);

    font(doc,C.muted);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.text(label,x+6,y+18);
  }

  function panel(doc,x,y,w,h,t,sub) {
    fill(doc,C.white);
    draw(doc,C.border);
    box(doc,x,y,w,h,true);

    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.text(t,x+7,y+10);

    font(doc,C.muted);
    doc.setFont("helvetica","normal");
    doc.setFontSize(6.3);
    doc.text(sub,x+7,y+16);
  }

  function donut(doc,data,x,y,w,h,titleText,sub,palette) {
    panel(doc,x,y,w,h,titleText,sub);

    const total = data.reduce((a,b)=>a+b.value,0);

    if(!total) {
      font(doc,C.muted);
      doc.setFontSize(8);
      doc.text("No data available",x+w/2,y+h/2,{align:"center"});
      return;
    }

    const cx=x+55, cy=y+58, r=31, inner=17;
    let start=-Math.PI/2;

    data.forEach((d,i)=>{
      const a=(d.value/total)*Math.PI*2;
      const steps=Math.max(8,Math.ceil(a*16));

      fill(doc,palette[i%palette.length]);

      for(let j=0;j<steps;j++){
        const a1=start+a*j/steps;
        const a2=start+a*(j+1)/steps;

        const x1=cx+r*Math.cos(a1);
        const y1=cy+r*Math.sin(a1);
        const x2=cx+r*Math.cos(a2);
        const y2=cy+r*Math.sin(a2);

        try {
          doc.triangle(cx,cy,x1,y1,x2,y2,"F");
        } catch(e) {}
      }

      start+=a;
    });

    fill(doc,C.white);
    doc.circle(cx,cy,inner,"F");

    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(16);
    doc.text(String(total),cx,cy+2,{align:"center"});

    font(doc,C.muted);
    doc.setFont("helvetica","normal");
    doc.setFontSize(6);
    doc.text("records",cx,cy+8,{align:"center"});

    data.forEach((d,i)=>{
      const ly=y+43+i*12;

      fill(doc,palette[i%palette.length]);
      doc.rect(x+105,ly-3,4,4,"F");

      font(doc,C.text);
      doc.setFontSize(6.5);
      doc.text(`${short(d.label,25)} (${d.value})`,x+112,ly);
    });
  }

  function bar(doc,data,x,y,w,h,titleText,sub,color) {
    panel(doc,x,y,w,h,titleText,sub);

    if(!data.length) {
      font(doc,C.muted);
      doc.setFontSize(8);
      doc.text("No data available",x+w/2,y+h/2,{align:"center"});
      return;
    }

    const cx=x+15,cy=y+27,cw=w-25,ch=h-43;
    const max=Math.max(1,...data.map(d=>d.value));

    draw(doc,C.border);
    doc.setLineWidth(.2);

    for(let i=0;i<=4;i++){
      const gy=cy+ch-ch*i/4;
      doc.line(cx,gy,cx+cw,gy);

      font(doc,C.muted);
      doc.setFontSize(5.3);
      doc.text(String(Math.round(max*i/4)),cx-2,gy+2,{align:"right"});
    }

    const gap=7;
    const bw=Math.max(12,(cw-gap*(data.length-1))/data.length);

    data.forEach((d,i)=>{
      const bh=ch*d.value/max;
      const bx=cx+i*(bw+gap);
      const by=cy+ch-bh;

      fill(doc,color);
      doc.roundedRect(bx,by,bw,bh,1.5,1.5,"F");

      font(doc,C.text);
      doc.setFont("helvetica","bold");
      doc.setFontSize(6);
      doc.text(String(d.value),bx+bw/2,by-3,{align:"center"});

      font(doc,C.muted);
      doc.setFont("helvetica","normal");
      doc.setFontSize(5.5);
      doc.text(short(d.label,16),bx+bw/2,cy+ch+9,{
        align:"center",maxWidth:bw+12
      });
    });
  }

  function line(doc,data,x,y,w,h,titleText,sub,color) {
    panel(doc,x,y,w,h,titleText,sub);

    if(!data.length) {
      font(doc,C.muted);
      doc.setFontSize(8);
      doc.text("No dated SOS records available",x+w/2,y+h/2,{align:"center"});
      return;
    }

    const cx=x+16,cy=y+28,cw=w-27,ch=h-45;
    const max=Math.max(1,...data.map(d=>d.value));

    draw(doc,C.border);
    doc.setLineWidth(.2);

    for(let i=0;i<=4;i++){
      const gy=cy+ch-ch*i/4;
      doc.line(cx,gy,cx+cw,gy);

      font(doc,C.muted);
      doc.setFontSize(5.3);
      doc.text(String(Math.round(max*i/4)),cx-2,gy+2,{align:"right"});
    }

    if(data.length===1) {
      const px=cx+cw/2;
      const py=cy+ch-ch*data[0].value/max;

      fill(doc,color);
      doc.circle(px,py,2.5,"F");

      font(doc,C.muted);
      doc.setFontSize(5.5);
      doc.text(short(data[0].label,16),px,cy+ch+9,{align:"center"});
      return;
    }

    const pts=data.map((d,i)=>({
      x:cx+cw*i/(data.length-1),
      y:cy+ch-ch*d.value/max,
      d
    }));

    draw(doc,color);
    fill(doc,color);
    doc.setLineWidth(1.2);

    for(let i=0;i<pts.length-1;i++){
      doc.line(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y);
    }

    pts.forEach((p,i)=>{
      doc.circle(p.x,p.y,2,"F");

      font(doc,color);
      doc.setFont("helvetica","bold");
      doc.setFontSize(5.5);
      doc.text(String(p.d.value),p.x,p.y-4,{align:"center"});

      if(data.length<=7 || i===0 || i===data.length-1 ||
         i%Math.ceil(data.length/7)===0) {
        font(doc,C.muted);
        doc.setFont("helvetica","normal");
        doc.setFontSize(5.2);
        doc.text(short(p.d.label,14),p.x,cy+ch+9,{align:"center"});
      }
    });
  }

  function findings(fb,sos,types,trend) {
    const out=[];

    const openSOS=sos.filter(x=>!resolvedSOS(x)).length;
    const resolvedSOSCount=sos.filter(resolvedSOS).length;
    const openFB=fb.filter(x=>!resolvedFB(x)).length;
    const closedFB=fb.filter(resolvedFB).length;

    out.push(
      sos.length
        ? `${sos.length} SOS alert${sos.length===1?"":"s"} recorded: ${openSOS} open and ${resolvedSOSCount} resolved.`
        : "No SOS alerts are currently recorded."
    );

    out.push(
      fb.length
        ? `${fb.length} feedback record${fb.length===1?"":"s"} recorded: ${openFB} active and ${closedFB} resolved.`
        : "No feedback records are currently recorded."
    );

    if(types[0]) {
      out.push(
        `Most common feedback type: ${types[0].label} (${types[0].value} record${types[0].value===1?"":"s"}).`
      );
    }

    if(trend.length>=2) {
      out.push(
        `SOS activity changed from ${trend[0].value} on ${trend[0].label} to ${trend[trend.length-1].value} on ${trend[trend.length-1].label}.`
      );
    }

    return out;
  }

  function findingsBox(doc,items,y) {
    const h=20+items.length*9;

    fill(doc,C.blueLight);
    draw(doc,[190,207,232]);
    box(doc,P.left,y,P.right-P.left,h,true);

    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.text("Key Findings",P.left+7,y+10);

    items.forEach((s,i)=>{
      const yy=y+19+i*9;

      fill(doc,C.blue);
      doc.circle(P.left+8,yy-2,1,"F");

      font(doc,C.text);
      doc.setFont("helvetica","normal");
      doc.setFontSize(6.8);
      doc.text(short(s,125),P.left+13,yy);
    });
  }

  function table(doc,fb,sos,startY) {
    const rows=[];

    fb.forEach(x=>rows.push([
      "Feedback",
      x.createdAt||x.date,
      text(x.passengerName),
      text(x.trip),
      text(x.type),
      text(x.status)
    ]));

    sos.forEach(x=>rows.push([
      "SOS",
      x.createdAt,
      text(x.passengerName),
      text(x.trip),
      "Emergency",
      text(x.status)
    ]));

    rows.sort((a,b)=>new Date(b[1])-new Date(a[1]));
    if(!rows.length) return;

    const heads=["Type","Date","Passenger","Trip","Category","Status"];
    const widths=[20,32,34,43,25,24];
    const total=widths.reduce((a,b)=>a+b,0);
    const rh=7;
    const x=P.left;

    font(doc,C.navy);
    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.text("Feedback & SOS Records",x,startY);

    let y=startY+8;

    fill(doc,C.blue);
    doc.rect(x,y,total,8,"F");

    let hx=x;
    heads.forEach((h,i)=>{
      font(doc,C.white);
      doc.setFontSize(5.6);
      doc.text(h,hx+2,y+5.2);
      hx+=widths[i];
    });

    y+=8;

    rows.forEach((r,idx)=>{
      if(y>267) {
        footer(doc);
        doc.addPage();
        header(doc,doc.getNumberOfPages());
        y=24;

        fill(doc,C.blue);
        doc.rect(x,y,total,8,"F");

        let hxx=x;
        heads.forEach((h,i)=>{
          font(doc,C.white);
          doc.setFontSize(5.6);
          doc.text(h,hxx+2,y+5.2);
          hxx+=widths[i];
        });

        y+=8;
      }

      if(idx%2===0) {
        fill(doc,C.panel);
        doc.rect(x,y,total,rh,"F");
      }

      let cx=x;

      r.forEach((v,i)=>{
        draw(doc,C.border);
        doc.setLineWidth(.15);
        doc.rect(cx,y,widths[i],rh,"S");

        font(doc,C.text);
        doc.setFont("helvetica","normal");
        doc.setFontSize(5.1);

        let displayValue=v;
        if(i===1) displayValue=dateTime(v);

        if(i===5 && ["resolved","closed"].includes(status(v))) {
          font(doc,C.green);
        } else if(i===5) {
          font(doc,C.red);
        }

        doc.text(short(displayValue,i===3?24:18),cx+2,y+4.7);
        cx+=widths[i];
      });

      y+=rh;
    });
  }

  /*
   * Opens a browser tab immediately.
   * This is the important fix.
   *
   * The old version waited for jsPDF to load before calling
   * window.open(), so browsers could treat it as a blocked popup.
   */
  function openPreviewWindow() {
    const previewWindow = window.open("about:blank","_blank");

    if(!previewWindow) {
      toast("Preview was blocked by the browser. Please allow pop-ups for BusPal.");
      return null;
    }

    try {
      previewWindow.document.title="BusPal Report Preview";
      previewWindow.document.body.innerHTML=`
        <div style="
          margin:0;
          height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          font-family:Arial,sans-serif;
          color:#5b697e;
          background:#f8fafd;
        ">
          Generating report preview…
        </div>`;
    } catch(e) {}

    return previewWindow;
  }

  async function generateFeedbackReport({
    feedback=[],
    sos=[],
    preview=true
  }={}) {

    feedback=arr(feedback);
    sos=arr(sos);

    /*
     * Generate Report = PREVIEW by default.
     *
     * Open the tab BEFORE awaiting jsPDF.
     */
    const previewWindow=preview ? openPreviewWindow() : null;

    try {
      const jsPDF=await loadJsPDF();

      await loadLogoData();

      const doc=new jsPDF({
        orientation:"portrait",
        unit:"mm",
        format:"a4",
        compress:true
      });

      const types=typeData(feedback);
      const fbStatus=feedbackStatus(feedback);
      const sosStatusData=sosStatus(sos);
      const trend=sosTrend(sos);
      const byTrip=sosByTrip(sos);

      /* PAGE 1 */
      header(doc,1);
      title(
        doc,
        "Feedback & SOS Report",
        "Summary of passenger feedback, complaints and emergency alerts."
      );
      reportDate(doc);

      const cw=42.5,g=3.5,y=48;

      card(doc,P.left,y,cw,feedback.length,"Total feedback",C.blue);
      card(doc,P.left+cw+g,y,cw,sos.length,"Total SOS",C.red);
      card(
        doc,
        P.left+(cw+g)*2,
        y,
        cw,
        sos.filter(x=>!resolvedSOS(x)).length,
        "Open SOS",
        C.orange
      );
      card(
        doc,
        P.left+(cw+g)*3,
        y,
        cw,
        feedback.filter(resolvedFB).length,
        "Resolved feedback",
        C.green
      );

      findingsBox(
        doc,
        findings(feedback,sos,types,trend),
        80
      );

      /*
       * Kept lower as requested.
       */
      table(doc,feedback,sos,150);
      footer(doc);

      /* PAGE 2 */
      doc.addPage();
      header(doc,2);
      title(
        doc,
        "Feedback & SOS Analysis",
        "Current status distribution and feedback categories."
      );

      /*
       * One graph above the other.
       */
      donut(
        doc,
        sosStatusData,
        P.left,
        47,
        P.right-P.left,
        105,
        "SOS Status",
        "Open versus resolved emergency alerts.",
        [C.red,C.green]
      );

      bar(
        doc,
        types.slice(0,8),
        P.left,
        158,
        P.right-P.left,
        105,
        "Feedback Categories",
        "Recorded feedback by type.",
        C.blue
      );

      footer(doc);

      /* PAGE 3 */
      doc.addPage();
      header(doc,3);
      title(
        doc,
        "Feedback & SOS Analysis",
        "Trend and resolution analysis."
      );

      line(
        doc,
        trend.slice(-14),
        P.left,
        47,
        P.right-P.left,
        105,
        "SOS Alerts Over Time",
        "Daily SOS alerts from dated records.",
        C.blue
      );

      donut(
        doc,
        fbStatus,
        P.left,
        158,
        P.right-P.left,
        105,
        "Feedback Status",
        "Active versus resolved feedback.",
        [C.orange,C.green]
      );

      footer(doc);

      /* PAGE 4 */
      if(byTrip.length) {
        doc.addPage();
        header(doc,4);
        title(
          doc,
          "SOS Analysis",
          "Distribution of SOS alerts by the trip value recorded by the system."
        );

        bar(
          doc,
          byTrip.slice(0,12),
          P.left,
          47,
          P.right-P.left,
          115,
          "SOS Alerts by Trip / Bus",
          "Uses the trip value supplied by the Feedback & SOS API.",
          C.red
        );

        findingsBox(
          doc,
          [
            `Highest recorded group: ${byTrip[0].label} (${byTrip[0].value} alert${byTrip[0].value===1?"":"s"}).`
          ],
          170
        );

        footer(doc);
      }

      const pages=doc.getNumberOfPages();

      for(let i=1;i<=pages;i++) {
        doc.setPage(i);
        font(doc,C.muted);
        doc.setFont("helvetica","normal");
        doc.setFontSize(6.5);
        doc.text(`Page ${i} of ${pages}`,P.right,291,{align:"right"});
      }

      const stamp=new Date().toISOString().slice(0,10);
      const filename=`BusPal-Feedback-SOS-Report-${stamp}.pdf`;

      /*
       * PREVIEW
       *
       * The generated PDF is loaded into the already-open tab.
       * The browser PDF viewer then gives the user its own Download
       * button. Nothing is downloaded automatically.
       */
      if(preview) {
        const blob=doc.output("blob");
        const url=URL.createObjectURL(blob);

        if(previewWindow) {
          try {
            previewWindow.location.href=url;
            previewWindow.focus();
          } catch(e) {
            window.open(url,"_blank");
          }

          setTimeout(()=>URL.revokeObjectURL(url),120000);
        } else {
          /*
           * Popup was blocked. Fall back to a direct preview URL.
           */
          window.location.href=url;
        }

        return;
      }

      /*
       * Optional direct download function.
       */
      doc.save(filename);

    } catch(error) {
      console.error("Feedback & SOS report error:",error);

      if(previewWindow) {
        try {
          previewWindow.document.body.innerHTML=`
            <div style="
              padding:30px;
              font-family:Arial,sans-serif;
              color:#dc2626;
            ">
              <h2>Could not generate report</h2>
              <p>${text(error?.message,"Unknown error")}</p>
              <p>Please close this tab and try again.</p>
            </div>`;
        } catch(e) {}
      }

      if(typeof toast==="function") {
        toast("Could not generate the Feedback & SOS report.");
      }
    }
  }

  /*
   * MAIN FUNCTION
   *
   * Your existing "Generate Report" button should already call:
   *
   * generateFeedbackReport({ feedback, sos })
   *
   * Because preview=true is now the DEFAULT, that button will
   * PREVIEW instead of downloading.
   */
  window.generateFeedbackReport=generateFeedbackReport;

  /*
   * Explicit preview function.
   */
  window.previewFeedbackReport=function({feedback=[],sos=[]}={}) {
    return generateFeedbackReport({
      feedback,
      sos,
      preview:true
    });
  };

  /*
   * Optional direct download function.
   *
   * If later you want a separate Download Report button, call:
   *
   * downloadFeedbackReport({ feedback, sos })
   */
  window.downloadFeedbackReport=function({feedback=[],sos=[]}={}) {
    return generateFeedbackReport({
      feedback,
      sos,
      preview:false
    });
  };

})();
