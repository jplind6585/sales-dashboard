/**
 * Add Sunrise Senior Living data for testing
 * This script adds the account and all three transcripts
 */

const fs = require('fs');
const path = require('path');

// Read the three Sunrise transcripts
const transcript1 = `Banner Introduction Call -

James Lindberg with Sunrise Senior Living
Recorded on Aug 21, 2025 via Zoom, 30m

Participants

Banner
James Lindberg

Sunrise Senior Living
Kristin Hart
Alyssa Carrabis
Aquene Hernandez, Senior Director, Capital Projects

Transcript

0:02 | Kristin
good morning. I'm good. Sorry, I'm trying to get all my stuff… situated here. How are you?

0:11 | James
Good, good.

0:12 | Kristin
Where are you based out of?

0:14 | James
Just outside Boston.

0:15 | Kristin
Oh, nice. Okay. How about yourself? I'm originally.

0:19 | James
From New Hampshire, but I've lived down in Baltimore, the UK, Boston.

0:23 | Kristin
Oh, wow. All right. Cool. Both Baltimore and Boston. I grew up in southern Maryland, and right now, I'm based in fairfax Virginia. So my husband's active duty military. So we're stationed here at the pentagon now in DC, but all my family's from Middleton and peabody, and they're all spread out around Boston now. Oh, yeah, nice.

0:44 | James
Nice. So you get to the area often, I assume.

0:48 | Kristin
Yeah. You know what? Because my husband's in the navy. We come through Newport, Rhode Island a lot and so, whenever we're up in the area, we try to spend time with them and visit and stuff. I was just with one of my cousins from up there who settled in westchester Pennsylvania a couple weeks ago. So we're pretty tight. I got a lot of cousins up there. So, yeah, we love Boston.

1:08 | James
Yeah, Newport's a great way, a great port to.

1:12 | Kristin
Isn't it? I know we're pretty thankful whenever we get, and usually when we're stationed there, it's like for six months, you know, like while my husband goes through some schooling there or something. So we really enjoy it. We try to get there like in the off season but not too, like not the winter but like not the peak season.

1:29 | James
No, fall is beautiful and early spring is beautiful. Yeah, summer's a little rough on traffic and people and then winter's.

1:36 | Kristin
just we have to pick the right location for a rental property whenever we're there because we're like, okay, we don't want to go through town to go to the grocery store because that'll be terrible. You know? Yeah. Hey, Alyssa morning. Good morning. How are you guys good. How are you? I was just chatting with James. He's based up in Boston. So we got some.

1:57 | Alyssa
I feel like, so I was talking with akani who I know is joining us shortly, but I don't remember if you were the point of contact. So, akani and I used to work for.

2:06 | James
blackfin. I saw that on LinkedIn ahead of the call. So I.

2:09 | Alyssa
don't remember if it was you that kind of helped spearhead like when, because we were looking at exploring banner like right before I left, but yeah, I was like,

2:19 | James
well, you'd worked with actually a woman named Alyssa. I kind of helped with some of the demos on that, but yeah. So I saw the name come through, looked it up and I was like that sounds familiar. And then blackfin was.

2:31 | Alyssa
Like,

2:33 | James
oh, okay. That makes sense.

2:36 | Alyssa
Well, we've been trying to put our heads together to try to come up with a solution here for like capital projects like planning and tracking and financials, and we've got a lot more, a lot more planning than we did at blackfin. We have a much bigger company. So hopefully this works out.

2:59 | Kristin
Akani probably communicated that we're feeling like we're lacking some of the tools that we need to be successful and we're exhausting a lot of man hours, you know, manually tracking and updating spreadsheets in excel. And so the girls had had experience, you know, with your product before. So I'm completely new to this. So I apologize. They're probably more well versed in your software, but I am not, so.

3:26 | Alyssa
When I think when I was exploring and I think akani had already transitioned to sunrise. So I, and it was a while ago for me. So I'm excited to get a refresher too.

3:36 | Kristin
Okay. I wasn't sure if you guys had already used it. Okay, great. All right. Well, then we're both on the same. We're all relatively on the same page.

3:45 | James
And actually just real quick, I had previously spoken with somebody at sunrise, Natalie wolentowski, is she still there? Yes?

3:53 | Alyssa
No. So she's no longer with the company. Yeah, she was previously my manager and she was, she found an opportunity. She ended up actually relocating to Texas for this position. So, for a separate position, but when I joined, she told me that she had met with you a little bit. So I apologize if you're having to kind of re, explain stuff again, but I repositioned a little bit and maybe akani, if you want to kick it off and give an intro and we can talk through all the good things.

4:25 | Aquene
Yeah, sure. Hi, I'm akani, I'm the senior director of capex, I actually set up this meeting. Not quite sure what you all were discussing before I joined. Sorry, I was a couple minutes late. My week has just been back by calls. Yeah. But essentially in a nutshell what we are trying to explore is the right capital budgeting reporting software right now. We don't have one and we're essentially using our accounting reports to generate or married into a reporting template that we provide either our owners or budget reports that we use internally. And, you know, some of the with that is first of all, we never know if our budget is real time because, you know, we have to download all the information. So, and we typically, I can't speak for Alyssa and Kristen, but just for my portfolio and my team, we only do it once a month. So I have to, as I'm looking at the budget towards the end of the month, I have to kind of build in sort of like, a cushion of X percent is probably already hit. So I really only have X spend remaining. So we really need something that's real time, something that speaks to our accounting software. Currently, we are using peoplesoft, we are supposed to transition to workday. But I believe we are a good year away from that transition. I don't know the full function capabilities of banner, but it seems like from what I observed on the website, it may be a tool that project managers may be able to use as well to enter in their POS.

6:12 | James
Yeah. And I was going to ask around just on the workflow side, you know, one of the things that we do is we try to kind of be that one stop shop for all of capex. So budgeting long term budgeting manage, you know, forecast cash flow, timely integrates with both peoplesoft and workday. I can kind of show where that would fit. But we also do the project management side around where we can, some clients use it. Some clients don't depending on the use case but scheduling bids, approvals, invoicing, change orders, etc, it's kind of the front door for everything including for the vendors when they're submitting stuff. Would that potentially be in scope here? Or would that just not be within, you know, what you're looking for?

6:58 | Aquene
So, I would say there's a clear delineation between what we capex need and what our project managers need. You know, we are essentially really just managing the budget. We're viewing, you know, what's ebbing and flowing and coming in and out so that we can report on those metrics as well as make decisions on approving other projects. Now, I think that would be a great tool for our construction team. They're not using anything currently. And I don't know what they may be exploring. I think our new development team may have looked into procore, but we have just to explain the difference. We have new development and then we have capital projects construction team. So, and I don't really think new development is going to be anything either. I think they're doing a lot of their budget management manually and spreadsheets as well. So, yes.

7:47 | Alyssa
Yeah.

7:48 | Aquene
I just, I thought this would just be a good starting point of like, yes, we have our needs. If this can address our needs, I would want to have another call with our VP of construction to see if this is something that our team can utilize as well.

8:06 | James
Okay. And then I guess just real quick as far as, you know, what you're getting from peoplesoft right now, where is that lacking? Because I'm thinking, you know, without a workflow, if you're just looking for financials and all the financials are in peoplesoft, you mentioned like a timing issue… but without workflows, basically the data would be coming and we can talk about like the POS and the invoices, but otherwise it would be coming from peoplesoft in which case, I'm not sure we can help with the timing side.

8:38 | Aquene
Yeah. So the data that comes from peoplesoft, it is based on purchase orders that are inputted, and also, you know, invoices.

8:50 | James
Okay. And what is it lacking as far as the reporting capabilities like today?

8:56 | Aquene
Right. So let's just say as an example, we have a project under construction, we have a design project under construction and there is a 1,000,000 dollars for that particular project. There may be, if you run the report, there may be 100 invoices that are to be coded against that project, but we have to manually enter formulas to actually see, you know, what that budget is, how much has kids, you know, deduct for that. And as, when the piece that's really missing is what's still open to stand?

9:42 | Alyssa
Yep. Yeah. I would echo a Connie. Yeah, previously, like, in a past life, we utilize that red, our red team software. And so we were able to dial into a project and click and the data would, you know, flow, from quickbooks as an example. So I would be able to go in and check in and look at my 1,000,000 dollar design project and see, okay, we've spent 25 percent on FF and E. We've contracted 50 percent of like our labor expense. However what we're having to do right now is download a report from peoplesoft and it's all raw data. So we have to go in and filter by like art or like a table console and manually add up or like try to formulate that data into something that one we can accurately track and manage the budget in a timely manner. And two something that can be like owner facing fairly quickly. Yeah, because I, not to speak for Connie or Kristen, but for myself, it's a it's I feel like it's a time consuming exercise for something that really we should be able to just look at a dashboard for example, like to have the answer to say, yeah, we've spent 90 percent like we may need to look at contingency et cetera.

11:06 | James
Okay. That makes perfect sense. And I guess, on that report, do you typically look at things? So is the kind of the granularity? Obviously, you want it at the project level. Do you also want it at the sov level, kind of the next level down? Like the individual line items on the contract? And then on the next level above, are you doing like portfolio level reports for the owners or for, you know, your executives of like here's what a portfolio or a subsection of our portfolio here's how it's performing?

11:36 | Alyssa
Yeah. Yes. Yeah.

11:38 | James
Okay. Pretty straightforward. Yeah, I'm just trying to think if there's any other questions I have a couple, but I will ask as we go if that works for you guys. Yeah, share my screen.

11:56 | James
Can you see, can you see my screen now? Yeah. So just two slides. I'll jump right over to. It is really, you know, we're designed to we're very specific in what we do. We help teams manage their capital projects and, you know, that's renovations. It's you know, asset preservation tis, we help with capex, we do stuff on the ground up in development but that's not really our core. We're a capital project management platform. And really our goal is manage the whole process. So managing a long term budget which we'll talk more about but that's three five seven or acquisition budget. How is that going against plan, being able to utilize things like asset trackers and, you know, site walkthroughs and all that to put together the budget for next year and not have to start with a blank slate, necessarily be able to track that budget with cost tracking that's timely integrated. And then manage those workflows. And again, I won't get really into it today if this is of interest and it seems like it's a fit. We can talk about that with the construction team but, or unless you want to see it, happy to show it you obviously, but things like bidding approvals, you know, scheduling document management, et cetera. So basically, if there's any question or anybody wants any information around capex, they should be able to go to I'll, just go to the dashboard here. They should be able to log into banner, be able to see all of the properties that you have, and within each property drill down into all of the projects. So, you know, for instance, you know, see at sunrise of lemonster, the one nearest to me in Boston here, you know, all of the, you know, all of the projects are ongoing. And and again, part of this is workflow, this is very configurable. So this has certain things around, you know, comments and updates and project notes. If that's helpful. Obviously, we can include that if you just want.

14:08 | Kristin
The other layer to this is that, yeah, we're having to chase people down for updates. And so we're trying to create one source of information where multiple people can touch it, provide updates that crosses that spans many departments, whether it's purchasing it facilities. And so, yeah, that's definitely huge because we would need the numbers side of it. But then we also need the update side of it.

14:32 | James
Perfect. So, and I don't when I get into this, I'll drill down into that. But, yeah, where you can. And again, this is all configurable like the stages or even just the columns, but be able to track things like what are we on stage? What is the last update? Where are we financially? And even things that are like pending? So like pending invoices and CEOS, all of that can be tracked within banner. I'll show, I'll really dig into it because all of this is roll up data. This is portfolio level data. You know, where you're able to see like I said, the whole portfolio, you could see a single property. You know, just how's that one property doing budget against forecast? You know, where are my projects? I have two, you know, of the 24 projects, I have two that are over budget, let's drill down into those. What's going on there, be able to drill into the project itself for any information that they might want to be able to see or you can use tags. And this would be really useful for like different ownership groups or you guys are so large with like things like region. So show me how the south region is doing or by asset manager, by construction manager, or by ownership group, or just types of projects. Show me where we are against, you know, show me all my roofing projects. I want to drill into that. Like what are we paying on a per square basis across the south region as an example?

15:57 | Kristin
And that's super important to ownership right now too on my portfolio. So.

16:03 | James
What being able to get kind of the historicals?

16:06 | Kristin
Well, yeah, or like per asset. Like they're just getting heavily involved in like in kind of into the weeds in terms of like they used to not really care too much, you know, like maybe an overall roofing job, they look at a figure, you know, or two. But if they knew it was needed, the roof was 30 years old, it was like it would just kind of get approved without many questions. And now they've increased the size of their team. And I think a few of the girls go through this too. But like they want to know things like, you know, like you just mentioned about the roofing and the cost per square foot or whatever it is. And like all the components. So it's getting a lot more, being able to recall that information quickly is great rather than having to dig into a proposal or dig into a contract, you know, to see all the, to see all that information.

16:51 | James
Perfect. Yeah. And again, like I said, the goal is to be that one stop shop. So any questions, you know, exactly where to go to? It's? Not peoplesoft or excel or sharepoint or something else off to the side. Last thing I'll just kind of mention before I jump in into a project a little bit is as I mentioned, we have the ability to do long term budgets. So something like this, you know, you'd be able to put together a plan. And oftentimes this is done obviously in coordination with ownership, but you can start looking out. So like a roof project, you know, roofing pavement, I imagine those tend to be, your larger projects. You can start anticipating. When are those going to be like? This is scheduled for 20 29. We're still going to review it. We might move it forward. We might move it out, but we should be reserving, you know, a sizable chunk of capex budget for that year because it's coming up and be able to actually look at that, you know, on a property by property and project by project basis. You know, going forward, this also enables you to… helps you kind of as you're doing kind of the site walkthroughs. I won't get in today, just high level demo today, but we have things like asset tracking. So you can see, you know, what roofs are coming to their expected end of their useful life in 20 26 or, you know, all of the equipment and acs and things like that. And you can start to put together a 20 26 plan and actually review that because you have all of your past years and you have all of your future years here. So the ability to actually.

18:26 | Kristin
Capture, I just have a question about how that gets captured because of Connie. This is what I was mentioning when I was talking about like the preventative maintenance plans that I put together in my previous life, it was like every like component of the building kind of had an age tied to it so we could do the same thing with like furniture, flooring, paint, carpet, whatever. But, is it a James in your experience? Is it a pretty big? You know, we have like 200 buildings. Is it a pretty big push? Like how long does it take people to actually be able to enter that data? And like get it? Because that I don't know it's just a thought I had about.

19:03 | James
it takes a while. What a lot of them will do is basically start with the big ones. So, you know, you wouldn't necessarily expect site teams to know when the last roofing was because that might be decades ago. So like they would, I'll just show you kind of like, you know, how it's set up is, you know, it's you could have again, there's different formats to this but generally speaking, you know, have different types categories. So you can sort by category or sort by, you know, end of life or by unit or sorry by property. But what a lot of them will do because we have the concept of forms is they'll have the site teams go through with a form and like basically check off certain things like we want you to go review, you know, any of the common area air handlers or things like that, like what was the last update?

19:52 | Kristin
And throw a date at it even if you don't know for sure. But so we can have an estimate or something like, yeah, exactly.

19:58 | James
And my guess is that your construction teams are probably doing sidewalks of a lot of the properties over the next two, three months. So for the budgeting process like.

20:07 | Alyssa
Yeah, they have a.

20:09 | James
form would be helps with that stuff.

20:11 | Alyssa
Yeah. So they actually just wrapped up, but, our, at each of our communities, we have, you know, we have a facilities team and so boots on the ground is our maintenance coordinators. And then we have, you know, area facilities managers, and then divisional directors. Okay. They do use the telus platform, however, I'm not sure what exactly is tracked within the telus platform. I do know that that's what they use, I think as like their service ticket service tickets for, you know, things that may go down in the units themselves, like toilet breaks, etc, but I'm curious. Maybe this is something that if you can put as a follow up to see if it integrates with tells, like if they have the data and tells, can it push to here? If not, maybe we can figure out like a back end like push through?

21:06 | Kristin
My question, my question two would be, if I apologize, I didn't give you a chance to answer James. I just like wanted to tag team that with if a job is put in or like would this automatically update or does it require manual updates? Like can the system detect when a component has been slated for replacement? And then also then in terms like work carried out or like a job tied to that dom trigger to automatically update? Or would we then manual? Because it's something I'm also kind of struggling with right now is like just making sure that information stays current and stays accurate based on the work we've done this year. And sometimes those jobs result from like, you know, an unbudgeted community request, sometimes they're budgeted, but again, you get like multiple sources of information and then you have to update it. So, yes.

21:57 | James
So… okay. So answering kind of the first question and then we'll come back to that. On the tell side, we've integrated with them before but not on the API. It's just not a common one for us. We can always look into apis. We have, we do literally dozens of them. It's not a huge lift. In any case. We can absolutely do kind of a data transfer even if it's like a periodic like with asset tracking, you don't need to do that on a daily basis, but it could just be like a report that dumps out, goes to an FTP, like a shared folder automatically pulls that data into banner. Like we build those for anything that we don't have an API. We just build the FTP with an automated report. It's really straightforward on our side. So short answer is we can get that data in. We just have to discuss, you know, if there's other tells things that we'd want to pull in. Maybe we want to do an API like kind of get the second question like work orders and things like that. If they're being completed in there, we can pull it through kind of fully answering that second question. It really depends on where the data is at. The core. Banner is kind of designed to be that workflow engine where everything flows through if it's not being utilized that way. And something else is we can normally pull that data in and sync it. But we'd have to know where that is. So my, you know, you mentioned that you have certain projects like an unplanned capex, like where does that actually live as far as, like when it gets submitted or when it's being invoiced against or when somebody is closing it out. Like where does that information live currently?

23:32 | Alyssa
In peoplesoft?

23:33 | Kristin
Yeah. Okay.

23:34 | James
So,

23:34 | Kristin
kind of categorized a little differently, but it's all there like and it's tied to the equipment or it's tied to, you know, the unbudgeted fund and stuff.

23:43 | James
Okay. So that would just be part of most likely. And again, we'd have to get into the details of what the integration, but that would be part of the integration with peoplesoft which we do have an API integration with. So we can pull a lot more data essentially automatically and trigger based. So most of the data we sync on a nightly basis. If there's things that are even more timely that need to be like when it happens, we trigger, we can set a trigger for most of that stuff.

24:08 | Kristin
Okay.

24:11 | James
Yeah. And then actually let me just show you just… kind of going back… where is it… within each project? Sorry, I was just doing a Canadian demo. You guys don't have any Canadian locations, do you?

24:29 | Alyssa
We do have a couple of communities in Canada. Yes. Okay.

24:34 | James
So, I'll just mention that we have currency, you know, exchanges so it can kind of sync it all into see it in local or see it at a global level. And again, I won't get too much into this. You know, this is more of that workflow where we have scheduling, you know, the scheduling tasks, notifications, documents for things like, you know, final guarantees or, you know, submittals, things like that. But basically on the financial side, one of the things that we can do. And again, we'd have to discuss what the workflow would be because there's a few different ways it can be done but you can drill all the way down to specific contract items and the line items on those contracts, and actually have things like the contract right here, but have all of kind of the schedule values broken out here and be able to see all those invoices. So not just see like at a high level, you know, obviously, you can see it like a portfolio or property or project level, like how are we doing financially? But if you ever need to drill down into a particular invoice, you'll have all of those details as well. So you get, very granular with this or very global with this. And all of this can come from or sync with depending on the workflow, it can push and pull from peoplesoft to make that a, you know, a timely, accurate updated even and I actually don't think I have it set up here. I don't I just don't have one, but even things like pending invoices. So when you're looking at your forecast, you can see not just what's approved, but anything that's got that's been rejected, those aren't super common, but the pending ones are so like as soon as they get submitted, we can pull it through. And then once it gets approved, we can show it as approved. But we can show pending as part of the, you know, forecast is, you know, is pending change orders, pending invoices, things like that?

26:33 | Alyssa
Yeah. I think something that I personally would like to see if we're able to maybe the next time we set up a demo would be to see how this looks with like the peoplesoft integration. We know we can't like move mountains right now, but at least we can move our mountain a little bit. And I think, you know, like they, like Connie had mentioned, we're eventually going to be transitioning all of our financials into workday. However, I would think it would be really beneficial for, our group here to see like what that integration looks like with the peoplesoft data. Cause I think what we're that's like a huge piece of it. And especially for me, it would be helpful for budgeting like carry over. So that would be something that I think we could all benefit from seeing how that works.

27:27 | James
Yeah, I can, absolutely, I know we're running out of time here. So happy to set up a deeper dive demo can highlight that as well as some of the kind of the edge cases, you know, what happens with like, you know, an invoice that's in peoplesoft but hasn't been assigned to like a specific project, but, you know, it goes to the property, like just how does that stuff flow through? And how does it get handled in banner to give you the reports that you're looking for?

27:56 | Alyssa
But.

27:56 | James
that, I guess based on what you've seen today, does it, you know, does it at a high level, kind of meet what you guys are looking for or hoping to see today? You know, would it make sense to set up that deeper dive demo?

28:09 | Aquene
Yeah, definitely. Yeah.

28:13 | James
Okay. One thing I would ask ahead of time just for the demo is if there was kind of one of those reports that you pull out of peoplesoft even if it was just kind of a sample of it, if you'd be able to share that with me? What I'll do on the demo is actually set it up, you know, with that data and I can talk about like this is where this data would live. This is where this data would live. And here's how that API integration would work because it's hard to show it into API integration because it just works in the background, but I can show you where each piece of your data would live in banner and kind of actually if you're also able to share any of those owner reports, I'll show you exactly like exactly what you can get out of banner that would help address those needs.

28:58 | Alyssa
Yeah.

28:59 | James
Okay. I'll shoot a follow up. If you're able to get that, it'll take me just a couple days, just prioritize and get that into a demo. You know, if you're able to get that to me tomorrow, any chance, you'd be free next Thursday or Friday for a demo?

29:20 | Alyssa
Yeah, I hope.

29:21 | Aquene
That they're dto on Friday, but there's actually… yeah, just, I might be free on Thursday too, but I'm probably making coming up. I was thinking about a vacation, but… Thursday may actually work.

29:41 | James
Oh, sorry, cut out a little faint there, so, next Thursday would work or?

29:45 | Aquene
Yeah, Thursday would probably be better. I was thinking about taking some time off for the holiday weekend.

29:50 | James
Oh, I forgot. It was the long weekend, yeah, coming.

29:54 | Aquene
Up. Sorry, I gotta.

29:56 | James
Start blocking off my Friday calendar here. I'm trying to book something and I'd like to take that off as well. So,

30:02 | Aquene
Second time trying to book something that Friday, I'm like, okay.

30:08 | James
Please, for the love of God, no, I don't want to, I don't want to watch a demo. I want to be at the beach.

30:13 | Alyssa
You will not have a captive audience.

30:16 | James
Like I said, I'm trying to, I'm trying to get away for that day too. Would the same time next Thursday work?

30:23 | Aquene
Yep.

30:24 | James
Okay. I'll shoot an invite. Then, like I said, I'll shoot a follow up if you were able to share the peoplesoft data and an example report. I'll set that up in the demo. So we have a really concise, you know, this is what it will look like here's. How it will work, go through every, you know, every, you know, everything that you guys might want to go through.

30:43 | Aquene
Okay.

30:45 | James
Well, sounds great. We will talk soon. All.

30:49 | Aquene
Right. Thank you so.

30:50 | Alyssa
Much. Thank you. Bye.`;

const API_BASE = 'http://localhost:3000/api';

async function main() {
  console.log('\n🚀 Adding Sunrise Senior Living test data...\n');

  try {
    // Step 1: Analyze the first transcript
    console.log('📝 Analyzing Introduction Call transcript...');
    const analyzeResponse = await fetch(`${API_BASE}/analyze-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcript1,
        existingContext: {
          transcripts: [],
          businessAreas: {},
          stakeholders: [],
          metrics: {}
        }
      })
    });

    if (!analyzeResponse.ok) {
      throw new Error(`Analysis failed: ${analyzeResponse.status}`);
    }

    const analysisData = await analyzeResponse.json();

    if (!analysisData.success) {
      throw new Error('Analysis did not succeed');
    }

    console.log('✅ Transcript analyzed successfully!');
    console.log('\n📊 Analysis Summary:');
    console.log('   - Call Type:', analysisData.analysis.callType);
    console.log('   - Call Date:', analysisData.analysis.callDate);
    console.log('   - Attendees:', analysisData.analysis.attendees?.length || 0);
    console.log('   - Stakeholders identified:', analysisData.analysis.stakeholders?.length || 0);

    // Show business areas with data
    const areasWithData = Object.entries(analysisData.analysis.businessAreas || {})
      .filter(([_, data]) => {
        const hasData = (data?.currentState?.length > 0 || data?.opportunities?.length > 0);
        return hasData;
      });

    console.log('\n📋 Business Areas Analyzed:');
    areasWithData.forEach(([areaId, data]) => {
      const priority = data.priority ? ` [${data.priority.toUpperCase()}]` : '';
      console.log(`   • ${areaId}${priority}`);
      console.log(`     - Current State: ${data.currentState?.length || 0} bullets`);
      console.log(`     - Opportunities: ${data.opportunities?.length || 0} bullets`);
    });

    console.log('\n✨ SUCCESS! The transcript has been analyzed.');
    console.log('\n📌 Next Steps:');
    console.log('   1. Open http://localhost:3000 in your browser');
    console.log('   2. Create a "Sunrise Senior Living" account');
    console.log('   3. Add this transcript in the Transcripts tab');
    console.log('   4. Go to Current State tab to see the analysis');
    console.log('   5. Go to Content tab to generate the Business Case document');
    console.log('\n💡 TIP: Add the other 2 Sunrise transcripts to see progressive refinement in action!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
