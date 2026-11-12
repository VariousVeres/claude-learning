import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function main() {
    let response = await client.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 1000,   
        output_config:{effort: "low"},      
        messages: [{ role: "user", content:  "Hey boy hey girl" }],
      }); 
        
      console.log("--------");
      console.log("Response ass array ",JSON.stringify(response.content, null, 2));
      console.log("Response model: " +response.model);      
      console.log("Response stop reason: " +response.stop_reason);      
  
    let text1= "";
        for (const b of response.content)  {
          if(b.type==="text") {
          text1+=b.text;
          }  
        }
    console.log(text1);

    const text2 = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(""); 
    console.log(text2);

}

main(); 